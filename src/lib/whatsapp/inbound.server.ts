import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { processAssistantTurn } from "@/lib/ai/conversation.server";

type Client = SupabaseClient<Database>;

const CHANNEL = "whatsapp";

function digits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/**
 * Resolves which business a message belongs to.
 * Primary: the business whose WhatsApp number matches the Twilio "To" number.
 * Fallback (shared Twilio Sandbox number): the only business in the workspace.
 */
async function resolveBusiness(supabase: Client, to: string) {
  const { data, error } = await supabase
    .from("businesses")
    .select("id, whatsapp_number, contact_number")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const businesses = data ?? [];
  if (businesses.length === 0) return null;

  const toDigits = digits(to);
  const matched = businesses.find(
    (b) =>
      (digits(b.whatsapp_number) && digits(b.whatsapp_number) === toDigits) ||
      (digits(b.contact_number) && digits(b.contact_number) === toDigits),
  );
  if (matched) return matched;
  return businesses.length === 1 ? businesses[0] : null;
}

/** Finds or creates the customer record for a WhatsApp sender. */
async function resolveCustomer(supabase: Client, businessId: string, phone: string, name: string) {
  const { data: existing, error } = await supabase
    .from("customers")
    .select("id, name")
    .eq("business_id", businessId)
    .eq("phone", phone)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (existing) return existing;

  const { data: created, error: insertError } = await supabase
    .from("customers")
    .insert({ business_id: businessId, phone, name })
    .select("id, name")
    .single();
  if (insertError) throw new Error(insertError.message);
  return created;
}

/** Most recent WhatsApp conversation for this customer, so context carries over. */
async function findOpenConversation(supabase: Client, businessId: string, customerId: string) {
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("id, created_at")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .eq("channel", CHANNEL)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  // Start a fresh thread after 12h of silence.
  const ageMs = Date.now() - new Date(data.created_at).getTime();
  return ageMs > 12 * 60 * 60 * 1000 ? null : data.id;
}

export interface IncomingWhatsAppMessage {
  from: string;
  to: string;
  body: string;
  profileName?: string | null;
  messageSid?: string | null;
}

/**
 * Routes an inbound WhatsApp message through the existing AI Business Assistant
 * (same business rules, catalogue, order creation, inventory and escalation
 * logic as the web app) and returns the customer-facing reply.
 */
export async function handleIncomingWhatsAppMessage(
  message: IncomingWhatsAppMessage,
): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const supabase = supabaseAdmin as unknown as Client;

  const business = await resolveBusiness(supabase, message.to);
  if (!business) {
    console.error("[whatsapp] no business matched for To=", message.to);
    return "This WhatsApp number is not linked to a business yet. Please contact the business directly.";
  }

  const phone = message.from;
  const customer = await resolveCustomer(
    supabase,
    business.id,
    phone,
    (message.profileName ?? "").trim() || "WhatsApp customer",
  );

  await supabase.from("whatsapp_messages").insert({
    business_id: business.id,
    customer_id: customer.id,
    direction: "inbound",
    body: message.body,
  });

  const conversationId = await findOpenConversation(supabase, business.id, customer.id);

  const result = await processAssistantTurn({
    supabase,
    businessId: business.id,
    conversationId,
    message: message.body,
    channel: CHANNEL,
    knownCustomer: {
      id: customer.id,
      phone,
      name: customer.name && customer.name !== "WhatsApp customer" ? customer.name : null,
    },
    serviceRole: true,
  });

  await supabase.from("whatsapp_messages").insert({
    business_id: business.id,
    customer_id: customer.id,
    order_id: result.order?.orderId ?? null,
    direction: "outbound",
    body: result.reply,
  });

  console.log(
    `[whatsapp] business=${business.id} sid=${message.messageSid ?? "-"} intent=${result.analysis.intent} order=${result.order?.orderNumber ?? "none"}`,
  );

  return result.reply;
}
