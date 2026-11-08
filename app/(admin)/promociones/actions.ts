"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { can, NO_PERMISSION, requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  createStripePromotion,
  deleteStripeCoupon,
  ensureStripeProducts,
  renameStripeCoupon,
  setStripePromotionCodeActive,
  stripeErrorMessage,
  type CatalogKind,
  type CatalogProduct,
} from "@/lib/stripe/promotions";
import { parsePesosToCents } from "@/lib/format";

export type ActionResult = { ok: boolean; message: string };

export type PromotionInput = {
  kind: string;
  name: string;
  code: string;
  discountType: string;
  value: string;
  /** datetime-local en hora de Ciudad de México. */
  startsAt: string;
  expiresAt: string;
  maxRedemptions: string;
  plans: string[];
  addons: string[];
};

type Parsed = {
  kind: "cupon" | "descuento" | "lanzamiento";
  name: string;
  code: string;
  discountType: "percent" | "amount";
  percentOff: number | null;
  amountOffCents: number | null;
  startsAt: Date;
  expiresAt: Date | null;
  maxRedemptions: number | null;
  plans: string[];
  addons: string[];
};

type StoredPromotion = {
  id: string;
  kind: string;
  name: string;
  code: string;
  discount_type: "percent" | "amount";
  percent_off: number | string | null;
  amount_off_cents: number | null;
  starts_at: string;
  expires_at: string | null;
  max_redemptions: number | null;
  times_redeemed: number;
  applies_to_plans: string[];
  applies_to_addons: string[];
  is_active: boolean;
  stripe_active: boolean;
  stripe_coupon_id: string | null;
  stripe_promotion_code_id: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Ciudad de México no tiene horario de verano desde 2022: UTC−6 todo el año. */
// shortcut: offset fijo −06:00 (toMexicoCityLocal sí usa la zona IANA), cambiarlo a Intl con TIME_ZONE si CDMX vuelve a tener horario de verano.
const fromMexicoCity = (value: string) => new Date(`${value}:00-06:00`);

function parse(input: PromotionInput): Parsed | { error: string } {
  if (!["cupon", "descuento", "lanzamiento"].includes(input.kind)) return { error: "Elige el tipo de promoción." };
  const name = input.name.trim();
  if (!name) return { error: "Escribe un nombre." };
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,40}$/.test(code)) return { error: "El código debe tener de 3 a 40 letras, números, guiones o guiones bajos, sin espacios." };
  if (input.discountType !== "percent" && input.discountType !== "amount") return { error: "Elige porcentaje o monto." };

  let percentOff: number | null = null;
  let amountOffCents: number | null = null;
  if (input.discountType === "percent") {
    const value = Number(input.value.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0 || value > 100 || Math.round(value * 100) !== value * 100) {
      return { error: "El porcentaje debe estar entre 0.01 y 100." };
    }
    percentOff = value;
  } else {
    amountOffCents = parsePesosToCents(input.value);
    if (!amountOffCents) return { error: "Monto no válido. Usa pesos y punto para los centavos, p. ej. 100 o 99.50." };
  }

  if (!LOCAL_DATETIME.test(input.startsAt)) return { error: "Elige la fecha de inicio." };
  const startsAt = fromMexicoCity(input.startsAt);
  let expiresAt: Date | null = null;
  if (input.expiresAt) {
    if (!LOCAL_DATETIME.test(input.expiresAt)) return { error: "Fecha de expiración no válida." };
    expiresAt = fromMexicoCity(input.expiresAt);
    if (expiresAt <= startsAt) return { error: "La expiración debe ser después del inicio." };
    if (expiresAt <= new Date()) return { error: "La expiración ya pasó." };
  }

  let maxRedemptions: number | null = null;
  if (input.maxRedemptions.trim()) {
    maxRedemptions = Number(input.maxRedemptions);
    if (!Number.isInteger(maxRedemptions) || maxRedemptions < 1 || maxRedemptions > 1_000_000) {
      return { error: "El máximo de usos debe ser un número entero mayor a 0." };
    }
  }

  const plans = [...new Set(input.plans)];
  const addons = [...new Set(input.addons)];
  if (plans.length + addons.length === 0) return { error: "Elige al menos un plan o complemento al que aplica." };

  return {
    kind: input.kind as Parsed["kind"],
    name: name.slice(0, 120),
    code,
    discountType: input.discountType,
    percentOff,
    amountOffCents,
    startsAt,
    expiresAt,
    maxRedemptions,
    plans,
    addons,
  };
}

function rpcPayload(parsed: Parsed, stripe: { couponId: string | null; promotionCodeId: string | null; active: boolean }, isActive: boolean) {
  return {
    kind: parsed.kind,
    name: parsed.name,
    code: parsed.code,
    discount_type: parsed.discountType,
    percent_off: parsed.percentOff === null ? "" : String(parsed.percentOff),
    amount_off_cents: parsed.amountOffCents === null ? "" : String(parsed.amountOffCents),
    starts_at: parsed.startsAt.toISOString(),
    expires_at: parsed.expiresAt ? parsed.expiresAt.toISOString() : "",
    max_redemptions: parsed.maxRedemptions === null ? "" : String(parsed.maxRedemptions),
    applies_to_plans: parsed.plans,
    applies_to_addons: parsed.addons,
    is_active: isActive,
    stripe_coupon_id: stripe.couponId,
    stripe_promotion_code_id: stripe.promotionCodeId,
    stripe_active: stripe.active,
  };
}

function fromStored(row: StoredPromotion): Parsed {
  return {
    kind: row.kind as Parsed["kind"],
    name: row.name,
    code: row.code,
    discountType: row.discount_type,
    percentOff: row.percent_off === null ? null : Number(row.percent_off),
    amountOffCents: row.amount_off_cents,
    startsAt: new Date(row.starts_at),
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    maxRedemptions: row.max_redemptions,
    plans: row.applies_to_plans,
    addons: row.applies_to_addons,
  };
}

function rpcError(error: { code?: string; message: string }): string {
  if (error.code === "42501") return NO_PERMISSION;
  if (error.code === "22023") return "Escribe un motivo (mínimo 3 caracteres).";
  if (error.code === "23505") return "Ya hay otra promoción activa con ese código.";
  if (error.code === "PGRST202" || /could not find the function/i.test(error.message)) {
    return "Falta aplicar la migración 20261005160000_admin_promociones.sql en Supabase.";
  }
  return error.message;
}

/** Products de Stripe de los planes y complementos elegidos (los crea si faltan). */
async function productIds(parsed: Parsed): Promise<string[]> {
  const service = createServiceRoleClient();
  const [plans, addons] = await Promise.all([
    service.from("plans").select("key, name, stripe_product_id").in("key", parsed.plans.length ? parsed.plans : ["__none__"]),
    service.from("addons").select("key, name, stripe_product_id").in("key", parsed.addons.length ? parsed.addons : ["__none__"]),
  ]);
  if (plans.error || addons.error) throw new Error((plans.error ?? addons.error)!.message);
  const items: CatalogProduct[] = [
    ...(plans.data ?? []).map((row) => ({ kind: "plan" as const, key: row.key as string, name: row.name as string, stripeProductId: row.stripe_product_id as string | null })),
    ...(addons.data ?? []).map((row) => ({ kind: "addon" as const, key: row.key as string, name: row.name as string, stripeProductId: row.stripe_product_id as string | null })),
  ];
  if (items.length !== parsed.plans.length + parsed.addons.length) throw new Error("Algún plan o complemento ya no existe.");

  const supabase = await createClient();
  const ids = await ensureStripeProducts(items, async (kind: CatalogKind, key: string, productId: string) => {
    const { error } = await supabase.rpc("admin_set_stripe_product", { p_kind: kind, p_key: key, p_product_id: productId });
    if (error) throw new Error(rpcError(error));
  });
  return [...ids.values()];
}

/** Deshace pasos en Stripe tras un fallo; si alguno no se puede deshacer lo dice en vez de callarlo. */
async function undoInStripe(steps: (() => Promise<void>)[]): Promise<string> {
  const failed: string[] = [];
  for (const step of steps) await step().catch((error) => failed.push(stripeErrorMessage(error)));
  return failed.length ? ` Tampoco se pudo deshacer en Stripe (${failed.join("; ")}): revisa el código en el dashboard de Stripe.` : "";
}

const sameArray = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

/**
 * Alta o edición. Stripe primero (fuente de verdad), luego la copia en la BD
 * con el motivo (bitácora). Si la BD falla, el código nuevo se desactiva en
 * Stripe para que no quede un cupón usable sin registro.
 */
export async function savePromotion(id: string | null, input: PromotionInput, reason: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!can(admin, "promociones.write")) return { ok: false, message: NO_PERMISSION };
  if (id !== null && !UUID.test(id)) return { ok: false, message: "Promoción no válida." };
  const why = reason.trim();
  if (why.length < 3) return { ok: false, message: "Escribe un motivo (mínimo 3 caracteres)." };
  const parsed = parse(input);
  if ("error" in parsed) return { ok: false, message: parsed.error };

  const supabase = await createClient();
  let current: StoredPromotion | null = null;
  if (id) {
    const { data } = await supabase.from("admin_promotions").select("*").eq("id", id).maybeSingle<StoredPromotion>();
    if (!data) return { ok: false, message: "Promoción no encontrada." };
    current = data;
  }

  const old = current ? fromStored(current) : null;
  const structural =
    !old ||
    !current?.stripe_coupon_id ||
    old.code !== parsed.code ||
    old.discountType !== parsed.discountType ||
    old.percentOff !== parsed.percentOff ||
    old.amountOffCents !== parsed.amountOffCents ||
    (old.expiresAt?.getTime() ?? null) !== (parsed.expiresAt?.getTime() ?? null) ||
    old.maxRedemptions !== parsed.maxRedemptions ||
    !sameArray(old.plans, parsed.plans) ||
    !sameArray(old.addons, parsed.addons);
  const isActive = current?.is_active ?? true;

  let stripeIds: { couponId: string | null; promotionCodeId: string | null; active: boolean };
  let created: Awaited<ReturnType<typeof createStripePromotion>> | null = null;
  let deactivatedOld = false;
  try {
    if (structural) {
      const remaining = parsed.maxRedemptions === null ? null : parsed.maxRedemptions - (current?.times_redeemed ?? 0);
      if (remaining !== null && remaining < 1) {
        return { ok: false, message: `Ya se usó ${current?.times_redeemed} veces: el máximo debe ser mayor a eso.` };
      }
      const products = await productIds(parsed);
      // El código es único entre los activos: se apaga el anterior antes de crear el nuevo.
      if (current?.stripe_promotion_code_id && current.stripe_active) {
        await setStripePromotionCodeActive(current.stripe_promotion_code_id, false);
        deactivatedOld = true;
      }
      created = await createStripePromotion({
        name: parsed.name,
        code: parsed.code,
        discountType: parsed.discountType,
        percentOff: parsed.percentOff,
        amountOffCents: parsed.amountOffCents,
        activate: isActive && parsed.startsAt <= new Date(),
        expiresAt: parsed.expiresAt,
        maxRedemptions: remaining,
        productIds: products,
        promotionId: id,
      });
      stripeIds = created;
    } else {
      if (old && old.name !== parsed.name && current?.stripe_coupon_id) await renameStripeCoupon(current.stripe_coupon_id, parsed.name);
      const shouldBeActive = isActive && parsed.startsAt <= new Date();
      if (current?.stripe_promotion_code_id && shouldBeActive !== current.stripe_active) {
        await setStripePromotionCodeActive(current.stripe_promotion_code_id, shouldBeActive);
      }
      stripeIds = { couponId: current!.stripe_coupon_id, promotionCodeId: current!.stripe_promotion_code_id, active: shouldBeActive };
    }
  } catch (error) {
    const oldCodeId = current?.stripe_promotion_code_id;
    const undo = await undoInStripe(deactivatedOld && oldCodeId ? [() => setStripePromotionCodeActive(oldCodeId, true)] : []);
    return { ok: false, message: stripeErrorMessage(error) + undo };
  }

  const { error } = await supabase.rpc("admin_save_promotion", {
    p_id: id,
    p_data: rpcPayload(parsed, stripeIds, isActive),
    p_reason: why,
  });
  if (error) {
    // Sin fila no debe quedar nada usable en Stripe: se apaga el código nuevo, se borra su cupón y vuelve el anterior.
    // Si el proceso muere antes de llegar aquí, el cron apaga el código huérfano (deactivateOrphanPromotionCodes).
    const oldCodeId = current?.stripe_promotion_code_id;
    const made = created;
    const undo = await undoInStripe([
      ...(made ? [() => setStripePromotionCodeActive(made.promotionCodeId, false), () => deleteStripeCoupon(made.couponId)] : []),
      ...(deactivatedOld && oldCodeId ? [() => setStripePromotionCodeActive(oldCodeId, true)] : []),
    ]);
    return { ok: false, message: rpcError(error) + undo };
  }
  redirect("/promociones");
}

/** Activar o desactivar (en Stripe y en la copia). Un programado se queda inactivo en Stripe hasta su inicio. */
export async function setPromotionActive(id: string, active: boolean, reason: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!can(admin, "promociones.write")) return { ok: false, message: NO_PERMISSION };
  if (!UUID.test(id)) return { ok: false, message: "Promoción no válida." };
  if (reason.trim().length < 3) return { ok: false, message: "Escribe un motivo (mínimo 3 caracteres)." };

  const supabase = await createClient();
  const { data: row } = await supabase.from("admin_promotions").select("*").eq("id", id).maybeSingle<StoredPromotion>();
  if (!row) return { ok: false, message: "Promoción no encontrada." };
  if (active && row.expires_at && new Date(row.expires_at) <= new Date()) {
    return { ok: false, message: "Ya venció: edítala con una nueva fecha de expiración." };
  }

  const parsed = fromStored(row);
  const stripeActive = active && parsed.startsAt <= new Date();
  const codeId = row.stripe_promotion_code_id;
  const changeStripe = codeId !== null && stripeActive !== row.stripe_active;
  try {
    if (changeStripe) await setStripePromotionCodeActive(codeId, stripeActive);
  } catch (error) {
    return { ok: false, message: stripeErrorMessage(error) };
  }

  const { error } = await supabase.rpc("admin_save_promotion", {
    p_id: id,
    p_data: rpcPayload(parsed, { couponId: row.stripe_coupon_id, promotionCodeId: row.stripe_promotion_code_id, active: stripeActive }, active),
    p_reason: reason.trim(),
  });
  if (error) {
    // Stripe ya cambió: se regresa a como estaba para que coincida con la BD.
    const undo = await undoInStripe(changeStripe ? [() => setStripePromotionCodeActive(codeId, row.stripe_active)] : []);
    return { ok: false, message: rpcError(error) + undo };
  }
  refresh();
  return { ok: true, message: active ? "Promoción activada." : "Promoción desactivada: el código ya no se puede usar." };
}
