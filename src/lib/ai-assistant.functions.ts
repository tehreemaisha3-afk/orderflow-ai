import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type {
  AssistantAnalysis,
  CreatedOrderSummary,
} from "@/lib/ai/types";

const SendMessageInput = z.object({
  conversationId: z.string().uuid().nullable().optional(),
  message: z.string().trim().min(1).max(2000),
  channel: z.string().max(30).default("test"),
});

export interface SendAssistantMessageResult {
  conversationId: string;
  reply: string;
  analysis: AssistantAnalysis;
  order: CreatedOrderSummary | null;
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

    const { processAssistantTurn } = await import("@/lib/ai/conversation.server");
    return processAssistantTurn({
      supabase,
      businessId: business.id,
      conversationId: data.conversationId ?? null,
      message: data.message,
      channel: data.channel,
    });
  });

