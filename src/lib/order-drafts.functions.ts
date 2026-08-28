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

const EditInput = z.object({
  draftId: z.string().uuid(),
  customer: z.object({
    name: z.string().trim().max(120).nullable().optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    city: z.string().trim().max(80).nullable().optional(),
    address: z.string().trim().max(400).nullable().optional(),
  }),
  paymentMethod: z.string().trim().max(60).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid().nullable(),
        mentioned_as: z.string().trim().max(200),
        quantity: z.number().int().min(1).max(9999),
        unit_price: z.number().min(0).max(10_000_000).nullable().optional(),
      }),
    )
    .max(30),
});

const ClarifyInput = z.object({
  draftId: z.string().uuid(),
  message: z.string().trim().min(1).max(1000),
});

/** Owner edit of a pending draft — re-validated, nothing committed yet. */
export const updateOrderDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => EditInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();
    if (businessError) throw new Error(businessError.message);
    if (!business) throw new Error("Business profile not found.");
    const businessId = business.id;

    const { updateDraft } = await import("@/lib/ai/drafts.server");
    const { loadAssistantContext } = await import("@/lib/ai/context.server");
    const assistantContext = await loadAssistantContext(supabase, businessId);

    return updateDraft({
      supabase,
      context: assistantContext,
      businessId,
      draftId: data.draftId,
      patch: {
        customer: data.customer,
        paymentMethod: data.paymentMethod ?? null,
        notes: data.notes ?? null,
        items: data.items,
      },
    });
  });

/** Sends a clarification question to the customer and keeps the draft pending. */
export const requestDraftClarification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ClarifyInput.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true; delivered: boolean }> => {
    const { supabase, userId } = context;

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, whatsapp_number, contact_number")
      .eq("owner_id", userId)
      .maybeSingle();
    if (businessError) throw new Error(businessError.message);
    if (!business) throw new Error("Business profile not found.");

    const { data: draft, error } = await supabase
      .from("order_drafts")
      .select("id, status, customer_id, extraction")
      .eq("id", data.draftId)
      .eq("business_id", business.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!draft) throw new Error("Draft not found.");
    if (draft.status !== "pending") throw new Error("This draft has already been reviewed.");

    let phone: string | null = null;
    if (draft.customer_id) {
      const { data: customer } = await supabase
        .from("customers")
        .select("phone")
        .eq("id", draft.customer_id)
        .eq("business_id", business.id)
        .maybeSingle();
      phone = customer?.phone ?? null;
    }
    if (!phone) {
      const extraction = (draft.extraction ?? {}) as {
        analysis?: { customer?: { phone?: string | null } };
      };
      phone = extraction.analysis?.customer?.phone ?? null;
    }

    const from =
      process.env["TWILIO_WHATSAPP_NUMBER"] || business.whatsapp_number || business.contact_number;

    let delivered = false;
    if (phone && from) {
      const { sendWhatsAppMessage } = await import("@/lib/whatsapp/twilio.server");
      await sendWhatsAppMessage({ to: phone, from, body: data.message });
      delivered = true;
      const { error: msgError } = await supabase.from("whatsapp_messages").insert({
        business_id: business.id,
        customer_id: draft.customer_id,
        direction: "outbound",
        body: data.message,
      });
      if (msgError) throw new Error(msgError.message);
    }

    const { error: noteError } = await supabase
      .from("order_drafts")
      .update({ reviewer_note: data.message.slice(0, 500) })
      .eq("id", data.draftId)
      .eq("business_id", business.id);
    if (noteError) throw new Error(noteError.message);

    await supabase.from("ai_processing_logs").insert({
      business_id: business.id,
      event_type: "draft_clarification_requested",
      payload: JSON.parse(JSON.stringify({ draft_id: data.draftId, delivered })),
    });

    if (!delivered) {
      throw new Error(
        "Saved the question, but it could not be sent: the customer has no WhatsApp number or no sender number is configured.",
      );
    }
    return { ok: true, delivered };
  });
