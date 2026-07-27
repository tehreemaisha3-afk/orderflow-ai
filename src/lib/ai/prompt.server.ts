import type { AssistantContext } from "./context.server";
import type { AssistantHistoryMessage } from "./types";

function section(title: string, body: string | null | undefined): string {
  const value = (body ?? "").trim();
  return value ? `## ${title}\n${value}` : "";
}

function list(values: string[] | null | undefined): string {
  return (values ?? []).filter(Boolean).join(", ");
}

function money(context: AssistantContext, value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return `${context.business.currency ?? "PKR"} ${value}`.trim();
}

/** Business profile block. */
function buildProfile(context: AssistantContext): string {
  const b = context.business;
  const rows = [
    ["Business name", b.business_name],
    ["Business type", b.business_type],
    ["Description", b.business_description],
    ["Owner", b.owner_name],
    ["Contact number", b.contact_number ?? b.whatsapp_number],
    ["Email", b.business_email],
    ["Address", b.business_address],
    ["Business hours", b.business_hours],
    ["Time zone", b.timezone],
    ["Currency", b.currency],
    ["Website", b.website],
  ].filter(([, v]) => Boolean(v));
  return section("Business profile", rows.map(([k, v]) => `- ${k}: ${v}`).join("\n"));
}

/** Product catalogue with aliases, prices and live stock. */
function buildCatalogue(context: AssistantContext): string {
  if (context.products.length === 0) {
    return section(
      "Product catalogue",
      "No products configured. You must not state any product, price or stock information.",
    );
  }
  const lines = context.products.map((p) => {
    const parts = [
      `- ${p.name}`,
      p.category ? `category: ${p.category}` : "",
      `price: ${money(context, p.price)} per ${p.unit}`,
      `stock: ${p.stock}`,
      p.sku ? `sku: ${p.sku}` : "",
      p.aliases.length ? `also called: ${p.aliases.join(", ")}` : "",
      p.description ? `details: ${p.description}` : "",
    ].filter(Boolean);
    return parts.join(" | ");
  });
  return section("Product catalogue", lines.join("\n"));
}

function buildDelivery(context: AssistantContext): string {
  const s = context.settings;
  if (!s) return "";
  const timeRules = Array.isArray(s.delivery_time_rules)
    ? (s.delivery_time_rules as Array<{ label?: string; duration?: string }>)
        .map((r) => `${r.label ?? ""}: ${r.duration ?? ""}`.trim())
        .filter((r) => r !== ":")
    : [];
  const rows = [
    s.delivery_methods?.length ? `- Methods: ${list(s.delivery_methods)}` : "",
    s.delivery_charge ? `- Delivery charge: ${money(context, s.delivery_charge)}` : "",
    s.free_delivery_threshold
      ? `- Free delivery above: ${money(context, s.free_delivery_threshold)}`
      : "",
    s.delivery_areas?.length ? `- Delivery areas: ${list(s.delivery_areas)}` : "",
    timeRules.length ? `- Delivery times: ${timeRules.join("; ")}` : "",
    s.shipping_policy ? `- Shipping policy: ${s.shipping_policy}` : "",
    s.return_policy ? `- Return policy: ${s.return_policy}` : "",
  ].filter(Boolean);
  return section("Delivery rules", rows.join("\n"));
}

function buildPayment(context: AssistantContext): string {
  const s = context.settings;
  if (!s) return "";
  const rows = [
    s.payment_methods?.length ? `- Accepted methods: ${list(s.payment_methods)}` : "",
    s.bank_name ? `- Bank: ${s.bank_name}` : "",
    s.bank_account_title ? `- Account title: ${s.bank_account_title}` : "",
    s.bank_account_number ? `- Account number: ${s.bank_account_number}` : "",
    s.payment_instructions ? `- Payment instructions: ${s.payment_instructions}` : "",
    s.advance_payment_policy ? `- Advance payment policy: ${s.advance_payment_policy}` : "",
    s.cod_policy ? `- Cash on delivery policy: ${s.cod_policy}` : "",
  ].filter(Boolean);
  return section("Payment rules", rows.join("\n"));
}

function buildCannedMessages(context: AssistantContext): string {
  const raw = context.settings?.canned_messages;
  if (!raw || typeof raw !== "object") return "";
  const entries = Object.entries(raw as Record<string, unknown>).filter(([, v]) =>
    Boolean(typeof v === "string" ? v.trim() : v),
  );
  if (!entries.length) return "";
  return section(
    "Standard business messages (adapt naturally, do not paste verbatim if it feels robotic)",
    entries.map(([k, v]) => `- ${k.replace(/_/g, " ")}: ${String(v)}`).join("\n"),
  );
}

function buildEscalation(context: AssistantContext): string {
  return section("Business-defined escalation rules", context.settings?.escalation_rules);
}

function buildCustomInstructions(context: AssistantContext): string {
  return section("Additional instructions from the business owner (highest priority)", context.settings?.ai_instructions);
}

const BASE_INSTRUCTIONS = `You are the AI business assistant for the business described below. You speak to that business's customers on its behalf, like an experienced, well-trained employee — never like a generic chatbot.

Behaviour rules:
1. Be professional, friendly, natural, concise and helpful. Never robotic, never slang unless instructed.
2. Use ONLY the business information provided below. Never invent prices, stock, delivery times, payment details, policies, discounts or product specifications.
3. If information is unavailable, say politely that you don't have that detail and offer to have the business owner confirm it.
4. Recognise products even when the customer uses an alias listed in the catalogue.
5. Ask only for information that is still missing. Never re-ask for details already present in the conversation.
6. Escalate to a human for refunds, warranty claims, legal complaints, abuse, repeated misunderstanding, or anything the business's escalation rules cover — and tell the customer politely that the business owner will follow up.
7. Keep replies short enough to read comfortably in a messaging app.`;

const OUTPUT_CONTRACT = `Respond with a single JSON object and nothing else (no markdown fences):
{
  "reply": "the message the customer will read",
  "analysis": {
    "intent": "new_order | modify_order | order_status | product_enquiry | price_enquiry | availability_enquiry | delivery_enquiry | payment_enquiry | business_info | complaint | support | greeting | other",
    "confidence": 0.0,
    "products": [{ "mentioned_as": "", "matched_product": null, "quantity": null, "unit_price": null, "notes": null }],
    "customer": { "name": null, "phone": null, "city": null, "address": null },
    "missing_fields": [],
    "next_action": "short description of what should happen next",
    "escalation_required": false,
    "escalation_reason": null,
    "payment_method": null,
    "order_confirmed": false
  }
}
Only include customer details that the customer actually provided in this conversation.
Set "order_confirmed" to true ONLY when the customer has explicitly confirmed a final order in their latest message (for example "yes, confirm", "place the order", "go ahead") AND the products with quantities are known. Never set it true for enquiries, greetings or while still collecting details. When it is true, repeat the full confirmed product list with quantities and unit prices, and include every customer detail you have (name, phone, city, address) plus "payment_method".`;

/** Builds the system prompt from live business data — nothing about the domain is hardcoded. */
export function buildSystemPrompt(context: AssistantContext): string {
  const toneLine = context.settings?.ai_tone
    ? `Preferred tone: ${context.settings.ai_tone}.`
    : "";
  return [
    BASE_INSTRUCTIONS,
    toneLine,
    buildProfile(context),
    buildCatalogue(context),
    buildDelivery(context),
    buildPayment(context),
    buildCannedMessages(context),
    buildEscalation(context),
    buildCustomInstructions(context),
    OUTPUT_CONTRACT,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildMessages(
  context: AssistantContext,
  history: AssistantHistoryMessage[],
  message: string,
) {
  return [
    { role: "system" as const, content: buildSystemPrompt(context) },
    ...history.slice(-20).map((m) => ({
      role: m.role === "customer" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    })),
    { role: "user" as const, content: message },
  ];
}
