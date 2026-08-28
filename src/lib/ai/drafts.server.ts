import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { AssistantContext } from "./context.server";
import { validateExtraction } from "./validation.server";
import { createOrderFromAnalysis } from "./orders.server";
import type { AssistantAnalysis, CreatedOrderSummary, OrderDraftSummary } from "./types";

type Client = SupabaseClient<Database>;

function toJson<T>(value: T) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Records a confirmed conversation as a *draft order awaiting owner approval*.
 * The AI never writes to orders or inventory directly any more — a human
 * approves first. Idempotent: one pending draft per conversation.
 */
export async function createDraftFromAnalysis(args: {
  supabase: Client;
  context: AssistantContext;
  analysis: AssistantAnalysis;
  conversationId: string;
  channel: string;
  sourceMessage: string;
  customerId?: string | null;
}): Promise<OrderDraftSummary | null> {
  const { supabase, context, analysis, conversationId, channel, sourceMessage, customerId } = args;
  const businessId = context.business.id;

  const { data: existing, error: existingError } = await supabase
    .from("order_drafts")
    .select("id, status, confidence, order_id")
    .eq("business_id", businessId)
    .eq("conversation_id", conversationId)
    .eq("status", "pending")
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  const validation = validateExtraction(context, analysis);

  if (existing) {
    const { error } = await supabase
      .from("order_drafts")
      .update({
        extraction: toJson({
          analysis,
          items: validation.items,
          total: validation.total,
          state: validation.state,
        }),
        issues: toJson(validation.issues),
        confidence: validation.confidence,
        detected_language: analysis.detected_language ?? null,
        source_message: sourceMessage.slice(0, 2000),
        customer_id: customerId ?? null,
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return {
      draftId: existing.id,
      status: "pending",
      confidence: validation.confidence,
      state: validation.state,
      total: validation.total,
      issues: validation.issues,
      duplicate: true,
    };
  }

  const { data: created, error } = await supabase
    .from("order_drafts")
    .insert({
      business_id: businessId,
      conversation_id: conversationId,
      customer_id: customerId ?? null,
      channel,
      status: "pending",
      detected_language: analysis.detected_language ?? null,
      confidence: validation.confidence,
      source_message: sourceMessage.slice(0, 2000),
      extraction: toJson({
        analysis,
        items: validation.items,
        total: validation.total,
        state: validation.state,
      }),
      issues: toJson(validation.issues),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  return {
    draftId: created.id,
    status: "pending",
    confidence: validation.confidence,
    state: validation.state,
    total: validation.total,
    issues: validation.issues,
    duplicate: false,
  };
}

/**
 * Owner approval: turns a pending draft into a real order using the existing
 * fulfillment path (customer upsert, order, items, inventory reservation).
 */
export async function approveDraft(args: {
  supabase: Client;
  businessId: string;
  draftId: string;
  loadContext: (businessId: string) => Promise<AssistantContext>;
}): Promise<CreatedOrderSummary> {
  const { supabase, businessId, draftId, loadContext } = args;

  const { data: draft, error } = await supabase
    .from("order_drafts")
    .select("*")
    .eq("id", draftId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!draft) throw new Error("Draft not found.");
  if (draft.status !== "pending") throw new Error("This draft has already been reviewed.");
  if (!draft.conversation_id) throw new Error("This draft is not linked to a conversation.");

  const context = await loadContext(businessId);
  const extraction = (draft.extraction ?? {}) as { analysis?: AssistantAnalysis };
  const analysis = extraction.analysis;
  if (!analysis) throw new Error("This draft has no usable extraction.");

  const order = await createOrderFromAnalysis({
    supabase,
    context,
    analysis,
    conversationId: draft.conversation_id,
    channel: draft.channel,
  });
  if (!order) throw new Error("Could not create an order from this draft.");

  const { error: updateError } = await supabase
    .from("order_drafts")
    .update({ status: "approved", order_id: order.orderId, reviewed_at: new Date().toISOString() })
    .eq("id", draftId)
    .eq("business_id", businessId);
  if (updateError) throw new Error(updateError.message);

  await supabase.from("ai_processing_logs").insert({
    business_id: businessId,
    order_id: order.orderId,
    event_type: "draft_approved",
    payload: toJson({ draft_id: draftId, order_number: order.orderNumber }),
  });

  return order;
}

export async function rejectDraft(args: {
  supabase: Client;
  businessId: string;
  draftId: string;
  note?: string | null;
}): Promise<void> {
  const { supabase, businessId, draftId, note } = args;
  const { error } = await supabase
    .from("order_drafts")
    .update({
      status: "rejected",
      reviewer_note: note?.slice(0, 500) ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", draftId)
    .eq("business_id", businessId)
    .eq("status", "pending");
  if (error) throw new Error(error.message);

  await supabase.from("ai_processing_logs").insert({
    business_id: businessId,
    event_type: "draft_rejected",
    payload: toJson({ draft_id: draftId }),
  });
}
