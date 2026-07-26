/**
 * Shared, channel-agnostic types for the AI Business Assistant.
 * These types are safe to import from both client and server code.
 */

export type AssistantChannel = "test" | "whatsapp" | "web" | "instagram" | "messenger";

export type AssistantRole = "customer" | "assistant";

export type CustomerIntent =
  | "new_order"
  | "modify_order"
  | "order_status"
  | "product_enquiry"
  | "price_enquiry"
  | "availability_enquiry"
  | "delivery_enquiry"
  | "payment_enquiry"
  | "business_info"
  | "complaint"
  | "support"
  | "greeting"
  | "other";

export interface ExtractedProduct {
  /** Raw text the customer used (alias or product name). */
  mentioned_as: string;
  /** Matched catalogue product name, or null when no confident match exists. */
  matched_product?: string | null;
  product_id?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  notes?: string | null;
}

export interface ExtractedCustomerInfo {
  name?: string | null;
  phone?: string | null;
  city?: string | null;
  address?: string | null;
}

/** Internal structured analysis produced for the business owner (never shown to customers). */
export interface AssistantAnalysis {
  intent: CustomerIntent;
  confidence: number;
  products: ExtractedProduct[];
  customer: ExtractedCustomerInfo;
  missing_fields: string[];
  next_action: string;
  escalation_required: boolean;
  escalation_reason?: string | null;
}

export interface AssistantTurn {
  /** Message the customer should see. */
  reply: string;
  /** Internal structured output for automation and analytics. */
  analysis: AssistantAnalysis;
}

export interface AssistantHistoryMessage {
  role: AssistantRole;
  content: string;
}

export const EMPTY_ANALYSIS: AssistantAnalysis = {
  intent: "other",
  confidence: 0,
  products: [],
  customer: {},
  missing_fields: [],
  next_action: "none",
  escalation_required: false,
  escalation_reason: null,
};
