import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { AssistantAnalysis, AssistantHistoryMessage } from "@/lib/ai/types";

const SendMessageInput = z.object({
  conversationId: z.string().uuid().nullable().optional(),
  message: z.string().trim().min(1).max(2000),
  channel: z.string().max(30).default("test"),
});

export interface SendAssistantMessageResult {
  conversationId: string;
  reply: string;
  analysis: AssistantAnalysis;
}

/**
 * Runs one customer turn through the AI conversation engine and persists both
 * sides of the conversation. Channel-agnostic: the same entry point will serve
 * WhatsApp / web chat once those channels are wired up.
 */
export const sendAssistantMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SendMessageInput.parse(input))
  .handler(async ({ data, context }): Promise<SendAssistantMessageResult> => {
    const { supabase, userId } = context;

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();
    if (businessError) throw new Error(businessError.message);
    if (!business) throw new Error("Please complete your business setup before using the assistant.");

    const { loadAssistantContext, runAssistantTurn } = await import("@/lib/ai/engine.server");
    const assistantContext = await loadAssistantContext(supabase, business.id);

    // Resolve or create the conversation.
    let conversationId = data.conversationId ?? null;
    if (conversationId) {
      const { data: existing, error } = await supabase
        .from("ai_conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("business_id", business.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!existing) conversationId = null;
    }
    if (!conversationId) {
      const { data: created, error } = await supabase
        .from("ai_conversations")
        .insert({
          business_id: business.id,
          channel: data.channel,
          title: data.message.slice(0, 60),
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      conversationId = created.id;
    }

    // Conversation memory.
    const { data: historyRows, error: historyError } = await supabase
      .from("ai_conversation_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(40);
    if (historyError) throw new Error(historyError.message);

    const history = (historyRows ?? []) as AssistantHistoryMessage[];

    const turn = await runAssistantTurn({
      context: assistantContext,
      history,
      message: data.message,
    });

    const { error: insertError } = await supabase.from("ai_conversation_messages").insert([
      {
        conversation_id: conversationId,
        business_id: business.id,
        role: "customer",
        content: data.message,
      },
      {
        conversation_id: conversationId,
        business_id: business.id,
        role: "assistant",
        content: turn.reply,
        metadata: JSON.parse(JSON.stringify(turn.analysis)),
      },
    ]);
    if (insertError) throw new Error(insertError.message);

    if (turn.analysis.escalation_required) {
      await supabase
        .from("ai_conversations")
        .update({ escalated: true })
        .eq("id", conversationId)
        .eq("business_id", business.id);
    }

    await supabase.from("ai_processing_logs").insert({
      business_id: business.id,
      event_type: "assistant_turn",
      payload: JSON.parse(JSON.stringify({
        conversation_id: conversationId,
        channel: data.channel,
        intent: turn.analysis.intent,
        confidence: turn.analysis.confidence,
        escalation_required: turn.analysis.escalation_required,
      })),
    });


    return { conversationId, reply: turn.reply, analysis: turn.analysis };
  });
