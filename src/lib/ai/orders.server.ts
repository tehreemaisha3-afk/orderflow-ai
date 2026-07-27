import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { AssistantContext } from "./context.server";
import type { AssistantAnalysis } from "./types";

type Client = SupabaseClient<Database>;

export interface CreatedOrderSummary {
  orderId: string;
  orderNumber: string;
  total: number;
  customerId: string;
  duplicate: boolean;
}

function normalise(value: string): string {
  return value.trim().toLowerCase();
}

/** Resolves an AI-mentioned product against the live catalogue (name, sku or alias). */
function matchProduct(context: AssistantContext, mentioned: string | null | undefined) {
  const needle = normalise(mentioned ?? "");
  if (!needle) return null;
  return (
    context.products.find((p) => normalise(p.name) === needle) ??
    context.products.find((p) => normalise(p.sku ?? "") === needle) ??
    context.products.find((p) => p.aliases.some((a) => normalise(a) === needle)) ??
    context.products.find((p) => normalise(p.name).includes(needle) || needle.includes(normalise(p.name))) ??
    null
  );
}

/**
 * Turns a confirmed AI conversation into real business records:
 * customer upsert -> order -> order items -> inventory reservation.
 *
 * Idempotent per conversation: a repeated confirmation returns the existing order.
 */
export async function createOrderFromAnalysis(args: {
  supabase: Client;
  context: AssistantContext;
  analysis: AssistantAnalysis;
  conversationId: string;
  channel: string;
}): Promise<CreatedOrderSummary | null> {
  const { supabase, context, analysis, conversationId, channel } = args;
  const businessId = context.business.id;

  // 1. Duplicate protection — one order per conversation confirmation.
  const { data: existingOrder, error: existingError } = await supabase
    .from("orders")
    .select("id, order_number, total, customer_id")
    .eq("business_id", businessId)
    .eq("ai_conversation_id", conversationId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existingOrder) {
    return {
      orderId: existingOrder.id,
      orderNumber: existingOrder.order_number,
      total: Number(existingOrder.total),
      customerId: existingOrder.customer_id ?? "",
      duplicate: true,
    };
  }

  // 2. Resolve line items against the catalogue.
  const items = (analysis.products ?? [])
    .map((p) => {
      const product = matchProduct(context, p.matched_product ?? p.mentioned_as);
      const quantity = Math.max(1, Math.round(Number(p.quantity ?? 1) || 1));
      const unitPrice = Number(
        p.unit_price ?? (product ? Number(product.price) : 0),
      );
      return {
        product_id: product?.id ?? null,
        product_name: product?.name ?? (p.matched_product || p.mentioned_as || "").trim(),
        quantity,
        unit_price: Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : 0,
      };
    })
    .filter((i) => i.product_name.length > 0);

  if (items.length === 0) return null;

  const phone = (analysis.customer.phone ?? "").trim();
  if (!phone) return null;

  const name = (analysis.customer.name ?? "").trim() || "WhatsApp customer";
  const city = (analysis.customer.city ?? "").trim() || null;
  const address = (analysis.customer.address ?? "").trim() || null;

  // 3. Customer: create or update by phone within the business.
  const { data: existingCustomer, error: customerFindError } = await supabase
    .from("customers")
    .select("id, name, city")
    .eq("business_id", businessId)
    .eq("phone", phone)
    .maybeSingle();
  if (customerFindError) throw new Error(customerFindError.message);

  let customerId: string;
  if (existingCustomer) {
    customerId = existingCustomer.id;
    const patch: Record<string, string> = {};
    if (name && name !== "WhatsApp customer" && name !== existingCustomer.name) patch.name = name;
    if (city && city !== existingCustomer.city) patch.city = city;
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase
        .from("customers")
        .update(patch)
        .eq("id", customerId)
        .eq("business_id", businessId);
      if (error) throw new Error(error.message);
    }
  } else {
    const { data: created, error } = await supabase
      .from("customers")
      .insert({ business_id: businessId, name, phone, city })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    customerId = created.id;
  }

  // 4. Order (sequential number per business).
  const { count, error: countError } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId);
  if (countError) throw new Error(countError.message);
  const orderNumber = `ORD-${String((count ?? 0) + 1).padStart(4, "0")}`;

  const total = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  const missing = (analysis.missing_fields ?? []).join(", ") || null;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      business_id: businessId,
      customer_id: customerId,
      ai_conversation_id: conversationId,
      source: channel,
      order_number: orderNumber,
      status: missing ? "awaiting_information" : "confirmed",
      payment_status: "unpaid",
      payment_method: analysis.payment_method ?? null,
      delivery_address: address,
      customer_notes: analysis.next_action || null,
      missing_information: missing,
      total,
    })
    .select("id, order_number, total")
    .single();
  if (orderError) {
    // Unique index on ai_conversation_id — a concurrent confirmation already created it.
    if ((orderError as { code?: string }).code === "23505") {
      const { data: raced } = await supabase
        .from("orders")
        .select("id, order_number, total")
        .eq("business_id", businessId)
        .eq("ai_conversation_id", conversationId)
        .maybeSingle();
      if (raced) {
        return {
          orderId: raced.id,
          orderNumber: raced.order_number,
          total: Number(raced.total),
          customerId,
          duplicate: true,
        };
      }
    }
    throw new Error(orderError.message);
  }

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(items.map((i) => ({ ...i, order_id: order.id })));
  if (itemsError) throw new Error(itemsError.message);

  // 5. Reserve inventory (idempotent, ownership-checked in the database).
  const { error: reserveError } = await supabase.rpc("reserve_order_inventory", {
    _order_id: order.id,
  });
  if (reserveError) throw new Error(reserveError.message);

  // 6. Link the conversation to the customer for future context.
  await supabase
    .from("ai_conversations")
    .update({ customer_id: customerId })
    .eq("id", conversationId)
    .eq("business_id", businessId);

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    total: Number(order.total),
    customerId,
    duplicate: false,
  };
}
