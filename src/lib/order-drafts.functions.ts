import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { CreatedOrderSummary } from "@/lib/ai/types";

const ApproveInput = z.object({ draftId: z.string().uuid() });
const RejectInput = z.object({
  draftId: z.string().uuid(),
  note: z.string().trim().max(500).optional(),
});

/** Approves an AI draft and creates the real order, items and inventory reservation. */
export const approveOrderDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ApproveInput.parse(input))
  .handler(async ({ data, context }): Promise<CreatedOrderSummary> => {
    const { supabase, userId } = context;
    const { data: business, error } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!business) throw new Error("Business profile not found.");

    const { approveDraft } = await import("@/lib/ai/drafts.server");
    const { loadAssistantContext } = await import("@/lib/ai/context.server");
    return approveDraft({
      supabase,
      businessId: business.id,
      draftId: data.draftId,
      loadContext: (businessId) => loadAssistantContext(supabase, businessId),
    });
  });

/** Rejects an AI draft without touching orders or inventory. */
export const rejectOrderDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RejectInput.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { data: business, error } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!business) throw new Error("Business profile not found.");

    const { rejectDraft } = await import("@/lib/ai/drafts.server");
    await rejectDraft({
      supabase,
      businessId: business.id,
      draftId: data.draftId,
      note: data.note ?? null,
    });
    return { ok: true };
  });
