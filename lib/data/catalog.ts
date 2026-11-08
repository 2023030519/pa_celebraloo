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

/** Un tramo de public.plan_prices: lo que cobra el checkout de Celebraloo. */
export type PlanPriceRow = {
  id: string;
  priceCents: number;
  /** timestamptz; null = sin límite por ese lado. */
  validFrom: string | null;
  validUntil: string | null;
  /** YYYY-MM-DD: el tramo solo aplica a eventos hasta esa fecha. */
  eventDateUntil: string | null;
  /** Respecto a hoy: dentro de su vigencia, antes de que empiece o ya terminada. */
  status: "current" | "scheduled" | "expired";
};

export type CatalogItem = {
  key: string;
  name: string;
  isActive: boolean;
  /**
   * Complementos: addons.price_cents. Paquetes: el precio de plan_prices que
   * cobra hoy una compra nueva (no plans.price_cents, que el checkout ya no usa).
   */
  priceCents: number | null;
  /** Tramos de plan_prices; vacío en complementos. */
  prices: PlanPriceRow[];
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

function priceStatus(from: string | null, until: string | null, now: number): PlanPriceRow["status"] {
  if (until && now > new Date(until).getTime()) return "expired";
  if (from && now < new Date(from).getTime()) return "scheduled";
  return "current";
}

/**
 * Precio que cobra hoy el checkout a una compra nueva: copia de
 * resolveCheckoutPriceCents (Celebraloo/lib/checkout/plan-price.ts). Sin fecha
 * de evento, event_date_until no cuenta; si ningún tramo está en vigencia, cae
 * al programado que no haya vencido. null = sin precio (el checkout no lo vende).
 * shortcut: regla copiada de otro repo, si cambia resolveCheckoutPriceCents cambia aquí (o muévela a una RPC compartida).
 */
function checkoutPriceCents(prices: PlanPriceRow[]): number | null {
  const current = prices.filter((price) => price.status === "current");
  const candidates = current.length ? current : prices.filter((price) => price.status !== "expired");
  return candidates.length ? Math.min(...candidates.map((price) => price.priceCents)) : null;
}

export const getCatalog = cache(async (): Promise<Catalog> => {
  const now = Date.now();
  const service = createServiceRoleClient();
  const [caps, plans, planCaps, addons, addonCaps, planPrices] = await Promise.all([
    service.from("capabilities").select("key, name, value_type, enum_values, description").order("name"),
    service.from("plans").select("key, name, is_active, price_cents, sort_order, stripe_product_id, stripe_price_id").order("sort_order"),
    service.from("plan_capabilities").select("plan_key, capability_key, value_boolean, value_integer, value_text"),
    service.from("addons").select("key, name, is_active, price_cents, stripe_product_id, stripe_price_id").order("name"),
    service.from("addon_capabilities").select("addon_key, capability_key, value_boolean, value_integer, value_text"),
    service
      .from("plan_prices")
      .select("id, plan_key, price_cents, valid_from, valid_until, event_date_until")
      .order("valid_from", { ascending: true, nullsFirst: true }),
  ]);
  const failed = [caps, plans, planCaps, addons, addonCaps, planPrices].find((result) => result.error);
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
      prices: [],
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
    plans: withCaps(plans.data ?? [], planCaps.data ?? [], "plan_key").map((plan) => {
      const prices = (planPrices.data ?? [])
        .filter((row) => row.plan_key === plan.key)
        .map((row) => ({
          id: row.id,
          priceCents: row.price_cents,
          validFrom: row.valid_from,
          validUntil: row.valid_until,
          eventDateUntil: row.event_date_until,
          status: priceStatus(row.valid_from, row.valid_until, now),
        }));
      return { ...plan, prices, priceCents: checkoutPriceCents(prices) };
    }),
    addons: withCaps(addons.data ?? [], addonCaps.data ?? [], "addon_key"),
  };
});

// Valores de texto conocidos en español; los demás, sin guiones bajos y con mayúscula inicial.
const VALUE_LABELS: Record<string, string> = {
  basic8: "Básicas (8)",
  platform: "En Celebraloo",
  email: "Por correo",
  coleccion_selecta: "Colección selecta",
};

export function formatValue(value: CapabilityValue): string {
  if (value.value_boolean !== null) return value.value_boolean ? "Sí" : "No";
  if (value.value_integer !== null) {
    return value.value_integer >= 1_000_000 ? "Ilimitado" : String(value.value_integer);
  }
  const text = value.value_text;
  if (!text) return "—";
  return VALUE_LABELS[text] ?? text.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
}

