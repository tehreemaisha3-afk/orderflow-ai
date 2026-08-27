import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SendInput = z.object({
  customerId: z.string().uuid(),
  body: z.string().trim().min(1).max(1500),
});

/**
 * Owner-initiated WhatsApp reply from the Messages inbox.
 * Sends through Twilio and records the outbound message for the thread.
 */
export const sendCustomerMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SendInput.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, whatsapp_number, contact_number")
      .eq("owner_id", userId)
      .maybeSingle();
    if (businessError) throw new Error(businessError.message);
    if (!business) throw new Error("Business profile not found.");

    // RLS scopes this to the owner's own customers.
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, phone")
      .eq("id", data.customerId)
      .eq("business_id", business.id)
      .maybeSingle();
    if (customerError) throw new Error(customerError.message);
    if (!customer?.phone) throw new Error("This customer has no WhatsApp number.");

    const from =
      process.env["TWILIO_WHATSAPP_NUMBER"] ||
      business.whatsapp_number ||
      business.contact_number;
    if (!from) {
      throw new Error("No WhatsApp sender number is configured for your business.");
    }

    const { sendWhatsAppMessage } = await import("@/lib/whatsapp/twilio.server");
    await sendWhatsAppMessage({ to: customer.phone, from, body: data.body });

    const { error: insertError } = await supabase.from("whatsapp_messages").insert({
      business_id: business.id,
      customer_id: customer.id,
      direction: "outbound",
      body: data.body,
    });
    if (insertError) throw new Error(insertError.message);

    return { ok: true };
  });
