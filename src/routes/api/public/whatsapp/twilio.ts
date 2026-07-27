import { createFileRoute } from "@tanstack/react-router";
import {
  isValidTwilioSignature,
  stripWhatsAppPrefix,
  twiml,
} from "@/lib/whatsapp/twilio.server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Twilio-Signature",
} as const;

export const Route = createFileRoute("/api/public/whatsapp/twilio")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),

      GET: async () =>
        new Response("Twilio WhatsApp webhook is live. Configure it as a POST webhook.", {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        }),

      POST: async ({ request }) => {
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        try {
          const raw = await request.text();
          const params: Record<string, string> = {};
          new URLSearchParams(raw).forEach((value, key) => {
            params[key] = value;
          });

          // Twilio signs the exact public URL it called.
          const forwardedProto = request.headers.get("x-forwarded-proto");
          const forwardedHost = request.headers.get("x-forwarded-host");
          const url = new URL(request.url);
          if (forwardedProto) url.protocol = `${forwardedProto}:`;
          if (forwardedHost) url.host = forwardedHost;

          if (authToken) {
            const valid = isValidTwilioSignature({
              authToken,
              url: url.toString(),
              params,
              signature: request.headers.get("x-twilio-signature"),
            });
            if (!valid) {
              console.error("[whatsapp] rejected request with invalid Twilio signature", url.toString());
              return new Response("Invalid signature", { status: 403 });
            }
          } else {
            console.warn("[whatsapp] TWILIO_AUTH_TOKEN is not set — skipping signature validation");
          }

          const from = stripWhatsAppPrefix(params.From ?? "");
          const to = stripWhatsAppPrefix(params.To ?? "");
          const body = (params.Body ?? "").trim();

          if (!from || !body) {
            console.warn("[whatsapp] ignoring message without sender or body", { from, hasBody: !!body });
            return twiml();
          }

          console.log(`[whatsapp] inbound from=${from} to=${to} sid=${params.MessageSid ?? "-"}`);

          const { handleIncomingWhatsAppMessage } = await import("@/lib/whatsapp/inbound.server");
          const reply = await handleIncomingWhatsAppMessage({
            from,
            to,
            body,
            profileName: params.ProfileName ?? null,
            messageSid: params.MessageSid ?? null,
          });

          return twiml(reply ?? undefined);
        } catch (error) {
          console.error("[whatsapp] webhook error", error);
          // Always answer Twilio with 200 + TwiML so the customer gets something.
          return twiml(
            "Sorry — we couldn't process your message right now. Please try again in a moment.",
          );
        }
      },
    },
  },
});
