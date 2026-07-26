import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

export type BusinessRow = Database["public"]["Tables"]["businesses"]["Row"];
export type BusinessSettingsRow = Database["public"]["Tables"]["business_settings"]["Row"];
export type ProductRow = Database["public"]["Tables"]["products"]["Row"];

export interface CatalogueProduct extends ProductRow {
  aliases: string[];
}

export interface AssistantContext {
  business: BusinessRow;
  settings: BusinessSettingsRow | null;
  products: CatalogueProduct[];
}

/**
 * Loads everything the AI needs to answer for a business.
 * Only active products are loaded — inactive items must never be offered.
 */
export async function loadAssistantContext(
  supabase: Client,
  businessId: string,
): Promise<AssistantContext> {
  const [businessRes, settingsRes, productsRes, aliasesRes] = await Promise.all([
    supabase.from("businesses").select("*").eq("id", businessId).maybeSingle(),
    supabase.from("business_settings").select("*").eq("business_id", businessId).maybeSingle(),
    supabase
      .from("products")
      .select("*")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .order("name"),
    supabase.from("product_aliases").select("product_id, alias").eq("business_id", businessId),
  ]);

  if (businessRes.error) throw new Error(businessRes.error.message);
  if (!businessRes.data) throw new Error("Business profile not found.");
  if (settingsRes.error) throw new Error(settingsRes.error.message);
  if (productsRes.error) throw new Error(productsRes.error.message);
  if (aliasesRes.error) throw new Error(aliasesRes.error.message);

  const aliasMap = new Map<string, string[]>();
  for (const row of aliasesRes.data ?? []) {
    const list = aliasMap.get(row.product_id) ?? [];
    list.push(row.alias);
    aliasMap.set(row.product_id, list);
  }

  return {
    business: businessRes.data,
    settings: settingsRes.data ?? null,
    products: (productsRes.data ?? []).map((p) => ({ ...p, aliases: aliasMap.get(p.id) ?? [] })),
  };
}
