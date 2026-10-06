import type { Catalog } from "@/lib/data/catalog";

/** A qué se puede aplicar un cupón: planes de pago y complementos activos con precio. */
export function promotionOptions(catalog: Catalog) {
  return {
    plans: catalog.plans
      .filter((plan) => plan.isActive && (plan.priceCents ?? 0) > 0)
      .map((plan) => ({ key: plan.key, name: plan.name })),
    addons: catalog.addons
      .filter((addon) => addon.isActive && (addon.priceCents ?? 0) > 0)
      .map((addon) => ({ key: addon.key, name: addon.name })),
  };
}
