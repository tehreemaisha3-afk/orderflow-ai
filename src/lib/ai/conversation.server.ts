import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { loadAssistantContext } from "./context.server";
import { runAssistantTurn } from "./engine.server";
import { createOrderFromAnalysis } from "./orders.server";
import type {
  AssistantAnalysis,
  AssistantHistoryMessage,
  CreatedOrderSummary,
} from "./types";

type Client = SupabaseClient<Database>;

export interface ProcessTurnArgs {
  supabase: Client;
  businessId: string;
  /** Existing conversation to continue, or null to start a new one. */
  conversationId?: string | null;
  message: string;
  channel: string;
  /** Known customer identity (e.g. the WhatsApp sender) merged into the analysis. */
  knownCustomer?: { id?: string | null; phone?: string | null; name?: string | null };
  /**
   * True when running with the service role (no auth.uid()), e.g. from the
   * WhatsApp webhook. Inventory is then reserved through the admin path.
   */
  serviceRole?: boolean;
}

export interface ProcessTurnResult {
  conversationId: string;
  reply: string;
  analysis: AssistantAnalysis;
  order: CreatedOrderSummary | null;
}

/**
 * Channel-agnostic orchestration for one customer turn:
 * conversation resolution -> memory -> AI turn -> persistence -> real order actions.
 * Both the in-app assistant console and the WhatsApp webhook call this.
 */
export async function processAssistantTurn({
  supabase,
  businessId,
  conversationId: incomingConversationId = null,
  message,
  channel,
  knownCustomer,
  serviceRole = false,
}: ProcessTurnArgs): Promise<ProcessTurnResult> {
  const assistantContext = await loadAssistantContext(supabase, businessId);

  let conversationId = incomingConversationId;
  if (conversationId) {
    const { data: existing, error } = await supabase
      .from("ai_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("business_id", businessId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!existing) conversationId = null;
  }
  if (!conversationId) {
    const { data: created, error } = await supabase
      .from("ai_conversations")
      .insert({
        business_id: businessId,
        channel,
        customer_id: knownCustomer?.id ?? null,
        title: message.slice(0, 60),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    conversationId = created.id;
  }

  const { data: historyRows, error: historyError } = await supabase
    .from("ai_conversation_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(40);
  if (historyError) throw new Error(historyError.message);

  const history = (historyRows ?? []) as AssistantHistoryMessage[];

  const turn = await runAssistantTurn({ context: assistantContext, history, message });

  // The channel may already know who the customer is (WhatsApp sender number).
  const analysis: AssistantAnalysis = {
    ...turn.analysis,
    customer: {
      ...turn.analysis.customer,
      phone: turn.analysis.customer.phone ?? knownCustomer?.phone ?? null,
      name: turn.analysis.customer.name ?? knownCustomer?.name ?? null,
    },
  };

  const { error: insertError } = await supabase.from("ai_conversation_messages").insert([
    {
      conversation_id: conversationId,
      business_id: businessId,
      role: "customer",
      content: message,
    },
    {
      conversation_id: conversationId,
      business_id: businessId,
      role: "assistant",
      content: turn.reply,
      metadata: JSON.parse(JSON.stringify(analysis)),
    },
  ]);
  if (insertError) throw new Error(insertError.message);

  if (analysis.escalation_required) {
    await supabase
      .from("ai_conversations")
      .update({ escalated: true })
      .eq("id", conversationId)
      .eq("business_id", businessId);
  }

  let order: CreatedOrderSummary | null = null;
  if (analysis.order_confirmed) {
    try {
      order = await createOrderFromAnalysis({
        supabase,
        context: assistantContext,
        analysis,
        conversationId,
        channel,
        serviceRole,
      });
    } catch (error) {
      console.error("[assistant] order creation failed", error);
      await supabase.from("ai_processing_logs").insert({
        business_id: businessId,
        event_type: "order_creation_failed",
        payload: JSON.parse(
          JSON.stringify({
            conversation_id: conversationId,
            channel,
            message: error instanceof Error ? error.message : String(error),
          }),
        ),
      });
    }
  }

  await supabase.from("ai_processing_logs").insert({
    business_id: businessId,
    event_type: "assistant_turn",
    payload: JSON.parse(
      JSON.stringify({
        conversation_id: conversationId,
        channel,
        intent: analysis.intent,
        confidence: analysis.confidence,
        escalation_required: analysis.escalation_required,
        order_confirmed: analysis.order_confirmed,
        order_id: order?.orderId ?? null,
        order_number: order?.orderNumber ?? null,
        duplicate_order: order?.duplicate ?? false,
      }),
    ),
  });

  return { conversationId, reply: turn.reply, analysis, order };
}
