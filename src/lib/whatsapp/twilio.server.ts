import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Twilio helpers. Credentials are read from server-side env vars only and are
 * never exposed to the browser.
 */

/** Strips the `whatsapp:` channel prefix Twilio adds to WhatsApp addresses. */
export function stripWhatsAppPrefix(value: string): string {
  return value.replace(/^whatsapp:/i, "").trim();
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Twilio's expected webhook response format. */
export function twiml(message?: string): Response {
  const body = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

/**
 * Validates the X-Twilio-Signature header.
 * Signature = base64(HMAC-SHA1(authToken, fullUrl + sorted key/value pairs)).
 */
export function isValidTwilioSignature(args: {
  authToken: string;
  url: string;
  params: Record<string, string>;
  signature: string | null;
}): boolean {
  const { authToken, url, params, signature } = args;
  if (!signature) return false;

  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);

  const expected = createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Optional outbound send through the Twilio REST API. The webhook replies with
 * TwiML by default; this is used for proactive messages when credentials exist.
 */
export async function sendWhatsAppMessage(args: {
  to: string;
  from: string;
  body: string;
}): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials are not configured.");
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: `whatsapp:${stripWhatsAppPrefix(args.to)}`,
        From: `whatsapp:${stripWhatsAppPrefix(args.from)}`,
        Body: args.body,
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    console.error(`[twilio] send failed ${response.status}: ${text}`);
    throw new Error(`Twilio send failed with status ${response.status}`);
  }
}
