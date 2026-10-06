import "server-only";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/server";

/**
 * Promociones en Stripe (fuente de verdad). Aquí solo se habla con Stripe;
 * lo que se guarda en la BD lo hacen las acciones con RPCs auditadas.
 *
 * Reglas de Stripe que determinan el diseño:
 * - Un Coupon no se puede editar (salvo nombre y metadata): cambiar el
 *   descuento, los productos, el límite o la vigencia crea uno nuevo.
 * - El código de un Promotion Code es único entre los códigos activos: para
 *   reutilizarlo hay que desactivar el anterior primero.
 * - No existe "fecha de inicio": el código se crea inactivo y se activa al
 *   llegar la fecha (sincronización).
 */

export type CatalogKind = "plan" | "addon";
export type CatalogProduct = { kind: CatalogKind; key: string; name: string; stripeProductId: string | null };

export type PromotionSpec = {
  name: string;
  code: string;
  discountType: "percent" | "amount";
  percentOff: number | null;
  amountOffCents: number | null;
  /** Activo desde ya; si es false (programado o desactivado) se crea inactivo. */
  activate: boolean;
  expiresAt: Date | null;
  /** Usos que le quedan al código nuevo (máximo − usos de códigos anteriores). */
  maxRedemptions: number | null;
  productIds: string[];
  promotionId: string | null;
};

const unix = (date: Date) => Math.floor(date.getTime() / 1000);

/** Crea (una sola vez) el Product de Stripe de cada plan o complemento que no lo tenga. */
export async function ensureStripeProducts(
  items: CatalogProduct[],
  save: (kind: CatalogKind, key: string, productId: string) => Promise<void>
): Promise<Map<string, string>> {
  const stripe = getStripe();
  const ids = new Map<string, string>();
  for (const item of items) {
    let productId = item.stripeProductId;
    if (!productId) {
      const product = await stripe.products.create(
        { name: item.name, metadata: { celebraloo_kind: item.kind, celebraloo_key: item.key } },
        // Mismo producto aunque se reintente (doble clic, error de red).
        { idempotencyKey: `celebraloo-product-${item.kind}-${item.key}` }
      );
      productId = product.id;
      await save(item.kind, item.key, productId);
    }
    ids.set(`${item.kind}:${item.key}`, productId);
  }
  return ids;
}

/** Coupon + Promotion Code nuevos. Devuelve sus ids y si el código quedó activo. */
export async function createStripePromotion(spec: PromotionSpec): Promise<{ couponId: string; promotionCodeId: string; active: boolean }> {
  const stripe = getStripe();
  const metadata = { celebraloo_code: spec.code, ...(spec.promotionId ? { celebraloo_promotion_id: spec.promotionId } : {}) };

  const coupon = await stripe.coupons.create({
    name: spec.name.slice(0, 40),
    duration: "once",
    ...(spec.discountType === "percent"
      ? { percent_off: spec.percentOff ?? undefined }
      : { amount_off: spec.amountOffCents ?? undefined, currency: "mxn" }),
    applies_to: { products: spec.productIds },
    ...(spec.expiresAt ? { redeem_by: unix(spec.expiresAt) } : {}),
    metadata,
  });

  const active = spec.activate;
  try {
    const promotionCode = await stripe.promotionCodes.create({
      promotion: { type: "coupon", coupon: coupon.id },
      code: spec.code,
      active,
      ...(spec.expiresAt ? { expires_at: unix(spec.expiresAt) } : {}),
      ...(spec.maxRedemptions ? { max_redemptions: spec.maxRedemptions } : {}),
      metadata,
    });
    return { couponId: coupon.id, promotionCodeId: promotionCode.id, active };
  } catch (error) {
    // Sin código el cupón no sirve: se borra para no dejar basura en Stripe.
    await stripe.coupons.del(coupon.id).catch(() => undefined);
    throw error;
  }
}

export async function setStripePromotionCodeActive(promotionCodeId: string, active: boolean): Promise<void> {
  await getStripe().promotionCodes.update(promotionCodeId, { active });
}

export async function renameStripeCoupon(couponId: string, name: string): Promise<void> {
  await getStripe().coupons.update(couponId, { name: name.slice(0, 40) });
}

export async function readStripePromotionCode(promotionCodeId: string): Promise<Stripe.PromotionCode> {
  return getStripe().promotionCodes.retrieve(promotionCodeId);
}

/** Mensaje legible de un error de Stripe. */
export function stripeErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "type" in error && "message" in error) {
    const { message, code } = error as { message: string; code?: string };
    if (code === "resource_already_exists") return "Ya existe un código activo igual en Stripe. Desactívalo o usa otro código.";
    return `Stripe: ${message}`;
  }
  return error instanceof Error ? error.message : String(error);
}
