import { CalendarClock, CircleCheck, CircleSlash, type LucideIcon } from "lucide-react";
import type { PromotionStatus } from "@/lib/data/admin";
import type { Catalog } from "@/lib/data/catalog";
import type { Tone } from "@/components/ui";

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

/** Estado calculado de una promoción, con ícono y texto (nunca solo color). */
export const PROMOTION_STATUS: Record<PromotionStatus, { label: string; tone: Tone; icon: LucideIcon }> = {
  activa: { label: "Activa", tone: "ok", icon: CircleCheck },
  programada: { label: "Programada", tone: "info", icon: CalendarClock },
  vencida: { label: "Vencida", tone: "neutral", icon: CircleSlash },
  agotada: { label: "Agotada", tone: "warn", icon: CircleSlash },
  inactiva: { label: "Inactiva", tone: "neutral", icon: CircleSlash },
};
