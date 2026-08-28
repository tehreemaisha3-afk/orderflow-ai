import type { AssistantContext } from "./context.server";
import type {
  AssistantAnalysis,
  DraftIssue,
  ProductSuggestion,
  ValidatedLineItem,
  ValidationResult,
  VerificationState,
} from "./types";

function normalise(value: string): string {
  return value.trim().toLowerCase();
}

/** Resolves an AI-mentioned product against the live catalogue (name, sku or alias). */
export function matchCatalogueProduct(
  context: AssistantContext,
  mentioned: string | null | undefined,
) {
  const needle = normalise(mentioned ?? "");
  if (!needle) return null;
  return (
    context.products.find((p) => normalise(p.name) === needle) ??
    context.products.find((p) => normalise(p.sku ?? "") === needle) ??
    context.products.find((p) => p.aliases.some((a) => normalise(a) === needle)) ??
    context.products.find(
      (p) => normalise(p.name).includes(needle) || needle.includes(normalise(p.name)),
    ) ??
    null
  );
}

function bigrams(value: string): string[] {
  const s = normalise(value).replace(/\s+/g, " ");
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i += 1) out.push(s.slice(i, i + 2));
  return out;
}

/** Dice coefficient — cheap, dependency-free string similarity. */
function similarity(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.length === 0 || B.length === 0) return 0;
  const pool = [...B];
  let hits = 0;
  for (const g of A) {
    const idx = pool.indexOf(g);
    if (idx >= 0) {
      hits += 1;
      pool.splice(idx, 1);
    }
  }
  return (2 * hits) / (A.length + B.length);
}

/** Only suggest a catalogue product when the match is confident enough to be useful. */
const SUGGESTION_THRESHOLD = 0.55;

export function suggestCatalogueProduct(
  context: AssistantContext,
  mentioned: string,
): ProductSuggestion | null {
  let best: ProductSuggestion | null = null;
  for (const p of context.products) {
    const candidates = [p.name, ...(p.aliases ?? []), p.sku ?? ""];
    const score = Math.max(...candidates.map((c) => (c ? similarity(mentioned, c) : 0)));
    if (!best || score > best.score) {
      best = { product_id: p.id, name: p.name, price: Number(p.price), stock: p.stock, score };
    }
  }
  if (!best || best.score < SUGGESTION_THRESHOLD) return null;
  return { ...best, score: Number(best.score.toFixed(2)) };
}

const REQUIRED_CUSTOMER_FIELDS: Array<{ key: "phone" | "name" | "address"; label: string; blocking: boolean }> = [
  { key: "phone", label: "phone number", blocking: true },
  { key: "name", label: "customer name", blocking: false },
  { key: "address", label: "delivery address", blocking: false },
];


/**
 * Verifies an AI extraction against the business's real catalogue before any
 * order is created: product must exist, price must match the catalogue, and
 * stock must cover the requested quantity.
 *
 * Nothing here writes to the database — it only produces a reviewable verdict.
 */
export function validateExtraction(
  context: AssistantContext,
  analysis: AssistantAnalysis,
): ValidationResult {
  const issues: DraftIssue[] = [];
  const items: ValidatedLineItem[] = [];

  for (const p of analysis.products ?? []) {
    const mentioned = (p.mentioned_as || p.matched_product || "").trim();
    if (!mentioned) continue;
    const product = matchCatalogueProduct(context, p.matched_product ?? p.mentioned_as);
    const quantity = Math.max(1, Math.round(Number(p.quantity ?? 1) || 1));

    if (!product) {
      const suggestion = suggestCatalogueProduct(context, mentioned);
      issues.push({
        code: "unknown_product",
        severity: "blocking",
        message: suggestion
          ? `"${mentioned}" is not in your catalogue. Closest match: ${suggestion.name}. Confirm it while editing this draft.`
          : `"${mentioned}" does not match any product in your catalogue. Select a product manually.`,
        field: mentioned,
      });
      items.push({
        mentioned_as: mentioned,
        product_id: null,
        product_name: mentioned,
        quantity,
        unit_price: Number(p.unit_price ?? 0) || 0,
        catalogue_price: null,
        stock_available: null,
        suggestion,
      });
      continue;
    }


    const cataloguePrice = Number(product.price);
    const extractedPrice = Number(p.unit_price ?? cataloguePrice);

    if (Number.isFinite(extractedPrice) && Math.abs(extractedPrice - cataloguePrice) > 0.009) {
      issues.push({
        code: "price_mismatch",
        severity: "warning",
        message: `${product.name}: the conversation used ${extractedPrice} but your catalogue price is ${cataloguePrice}. The catalogue price will be used.`,
        field: product.name,
      });
    }

    if (product.stock < quantity) {
      issues.push({
        code: "insufficient_stock",
        severity: "blocking",
        message: `${product.name}: ${quantity} requested but only ${product.stock} in stock.`,
        field: product.name,
      });
    }

    items.push({
      mentioned_as: mentioned,
      product_id: product.id,
      // The catalogue is always the source of truth for name and price.
      product_name: product.name,
      quantity,
      unit_price: cataloguePrice,
      catalogue_price: cataloguePrice,
      stock_available: product.stock,
    });
  }

  if (items.length === 0) {
    issues.push({
      code: "no_items",
      severity: "blocking",
      message: "No products could be identified in this conversation.",
    });
  }

  for (const field of REQUIRED_CUSTOMER_FIELDS) {
    const value = (analysis.customer?.[field.key] ?? "").toString().trim();
    if (!value) {
      issues.push({
        code: "missing_customer_field",
        severity: field.blocking ? "blocking" : "warning",
        message: `Missing ${field.label}.`,
        field: field.key,
      });
    }
  }

  const matched = items.filter((i) => i.product_id).length;
  const matchRate = items.length ? matched / items.length : 0;
  const modelConfidence = Math.min(Math.max(analysis.confidence ?? 0, 0), 1);
  const confidence = Number((modelConfidence * 0.5 + matchRate * 0.5).toFixed(2));

  const total = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);

  return {
    items,
    issues,
    confidence,
    total,
    blocking: issues.some((i) => i.severity === "blocking"),
  };
}
