import { loadAssistantContext, type AssistantContext } from "./context.server";
import { completeChat } from "./gateway.server";
import { buildMessages } from "./prompt.server";
import {
  EMPTY_ANALYSIS,
  type AssistantAnalysis,
  type AssistantHistoryMessage,
  type AssistantTurn,
  type CustomerIntent,
} from "./types";

const INTENTS: CustomerIntent[] = [
  "new_order",
  "modify_order",
  "order_status",
  "product_enquiry",
  "price_enquiry",
  "availability_enquiry",
  "delivery_enquiry",
  "payment_enquiry",
  "business_info",
  "complaint",
  "support",
  "greeting",
  "other",
];

function stripFences(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```[a-zA-Z]*\s*/, "").replace(/```$/, "").trim();
}

function coerceNumber(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/** Defensive parsing — a model may still drift from the requested shape. */
function parseTurn(raw: string, fallbackReply: string): AssistantTurn {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch {
    return { reply: raw.trim() || fallbackReply, analysis: { ...EMPTY_ANALYSIS } };
  }

  const obj = (parsed ?? {}) as Record<string, unknown>;
  const rawAnalysis = (obj.analysis ?? {}) as Record<string, unknown>;
  const rawCustomer = (rawAnalysis.customer ?? {}) as Record<string, unknown>;
  const intent = INTENTS.includes(rawAnalysis.intent as CustomerIntent)
    ? (rawAnalysis.intent as CustomerIntent)
    : "other";

  const analysis: AssistantAnalysis = {
    intent,
    confidence: Math.min(Math.max(coerceNumber(rawAnalysis.confidence) ?? 0, 0), 1),
    products: Array.isArray(rawAnalysis.products)
      ? rawAnalysis.products.slice(0, 25).map((item) => {
          const p = (item ?? {}) as Record<string, unknown>;
          return {
            mentioned_as: String(p.mentioned_as ?? p.matched_product ?? "").slice(0, 200),
            matched_product: p.matched_product ? String(p.matched_product) : null,
            quantity: coerceNumber(p.quantity),
            unit_price: coerceNumber(p.unit_price),
            notes: p.notes ? String(p.notes) : null,
          };
        })
      : [],
    customer: {
      name: rawCustomer.name ? String(rawCustomer.name) : null,
      phone: rawCustomer.phone ? String(rawCustomer.phone) : null,
      city: rawCustomer.city ? String(rawCustomer.city) : null,
      address: rawCustomer.address ? String(rawCustomer.address) : null,
    },
    missing_fields: Array.isArray(rawAnalysis.missing_fields)
      ? rawAnalysis.missing_fields.map((f) => String(f)).slice(0, 20)
      : [],
    next_action: rawAnalysis.next_action ? String(rawAnalysis.next_action) : "none",
    escalation_required: rawAnalysis.escalation_required === true,
    escalation_reason: rawAnalysis.escalation_reason ? String(rawAnalysis.escalation_reason) : null,
    order_confirmed: rawAnalysis.order_confirmed === true,
    payment_method: rawAnalysis.payment_method ? String(rawAnalysis.payment_method) : null,
    detected_language: rawAnalysis.detected_language
      ? String(rawAnalysis.detected_language).slice(0, 30)
      : null,
  };

  const reply = typeof obj.reply === "string" && obj.reply.trim() ? obj.reply.trim() : fallbackReply;
  return { reply, analysis };
}

export interface RunAssistantArgs {
  context: AssistantContext;
  history: AssistantHistoryMessage[];
  message: string;
}

/**
 * Channel-agnostic conversation engine. Any channel (test console, WhatsApp,
 * web chat, Instagram…) can call this with a message + history and get back a
 * customer-facing reply plus internal structured analysis.
 */
export async function runAssistantTurn({
  context,
  history,
  message,
}: RunAssistantArgs): Promise<AssistantTurn> {
  const raw = await completeChat(buildMessages(context, history, message));
  return parseTurn(
    raw,
    "Thanks for your message — I'll get back to you with the details shortly.",
  );
}

export { loadAssistantContext };
