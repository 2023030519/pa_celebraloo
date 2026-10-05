import "server-only";
import { cache } from "react";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export { formatMxn } from "@/lib/format";

export type CapabilityValueType = "boolean" | "integer" | "enum";

export type Capability = {
  key: string;
  name: string;
  valueType: CapabilityValueType;
  enumValues: string[];
  description: string | null;
};

/** Valor tal como lo guarda la BD: exactamente uno de los tres. */
export type CapabilityValue = {
  value_boolean: boolean | null;
  value_integer: number | null;
  value_text: string | null;
};

export type CatalogItem = {
  key: string;
  name: string;
  isActive: boolean;
  priceCents: number | null;
  /** IDs de Stripe informativos (el checkout cobra con price_data). */
  stripeProductId: string | null;
  stripePriceId: string | null;
  capabilities: (CapabilityValue & { capability_key: string })[];
};

export type Catalog = {
  capabilities: Capability[];
  plans: CatalogItem[];
  addons: CatalogItem[];
};

export const getCatalog = cache(async (): Promise<Catalog> => {
  const service = createServiceRoleClient();
  const [caps, plans, planCaps, addons, addonCaps] = await Promise.all([
    service.from("capabilities").select("key, name, value_type, enum_values, description").order("name"),
    service.from("plans").select("key, name, is_active, price_cents, sort_order, stripe_product_id, stripe_price_id").order("sort_order"),
    service.from("plan_capabilities").select("plan_key, capability_key, value_boolean, value_integer, value_text"),
    service.from("addons").select("key, name, is_active, price_cents, stripe_product_id, stripe_price_id").order("name"),
    service.from("addon_capabilities").select("addon_key, capability_key, value_boolean, value_integer, value_text"),
  ]);
  const failed = [caps, plans, planCaps, addons, addonCaps].find((result) => result.error);
  if (failed?.error) throw new Error(`No se pudo leer el catálogo: ${failed.error.message}`);

  const withCaps = (
    rows: {
      key: string;
      name: string;
      is_active: boolean;
      price_cents: number | null;
      stripe_product_id: string | null;
      stripe_price_id: string | null;
    }[],
    links: ({ capability_key: string } & CapabilityValue & Record<string, unknown>)[],
    linkKey: "plan_key" | "addon_key"
  ): CatalogItem[] =>
    rows.map((row) => ({
      key: row.key,
      name: row.name,
      isActive: row.is_active,
      priceCents: row.price_cents,
      stripeProductId: row.stripe_product_id,
      stripePriceId: row.stripe_price_id,
      capabilities: links
        .filter((link) => link[linkKey] === row.key)
        .map(({ capability_key, value_boolean, value_integer, value_text }) => ({
          capability_key,
          value_boolean,
          value_integer,
          value_text,
        })),
    }));

  return {
    capabilities: (caps.data ?? []).map((cap) => ({
      key: cap.key,
      name: cap.name,
      valueType: cap.value_type as CapabilityValueType,
      enumValues: (cap.enum_values as string[] | null) ?? [],
      description: cap.description,
    })),
    plans: withCaps(plans.data ?? [], planCaps.data ?? [], "plan_key"),
    addons: withCaps(addons.data ?? [], addonCaps.data ?? [], "addon_key"),
  };
});

export function formatValue(value: CapabilityValue): string {
  if (value.value_boolean !== null) return value.value_boolean ? "Sí" : "No";
  if (value.value_integer !== null) {
    return value.value_integer >= 1_000_000 ? "Ilimitado" : String(value.value_integer);
  }
  return value.value_text ?? "—";
}

