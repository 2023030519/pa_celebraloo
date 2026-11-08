"use server";

import { refresh } from "next/cache";
import { can, NO_PERMISSION, requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { parsePesosToCents } from "@/lib/format";
import { renameStripeProduct, stripeErrorMessage } from "@/lib/stripe/promotions";

export type ActionResult = { ok: boolean; message: string };

const INVALID_PRICE = "Precio no válido. Usa pesos y punto para los centavos, p. ej. 299 o 1990.50.";

/** Errores de Postgres sin traducir: el detalle va al log, no a la pantalla. */
function dbError(error: { code?: string; message: string }): string {
  console.error("[catalogo]", error);
  if (error.code === "22003") return "El precio es demasiado grande.";
  if (error.code === "23514" || error.code === "22023") return "Algún valor no es válido. Revisa el nombre y el precio.";
  return "No se pudo guardar. Intenta de nuevo.";
}

/** "299", "1,990.50", "" → centavos. "" solo vale para complementos (sin precio = no se vende). */
function parsePriceCents(raw: string): number | null | "invalid" {
  if (raw.replace(/[$\s]/g, "") === "") return null;
  const cents = parsePesosToCents(raw);
  // Columna integer: un precio mayor sale de rango y Postgres respondería en inglés.
  return cents === null || cents > 2_147_483_647 ? "invalid" : cents;
}

/**
 * Nombre y activo de un paquete; nombre, precio y activo de un complemento.
 * Va por RPC con la sesión del superadmin: la BD valida el rol y guarda
 * antes/después en Actividad. El precio de un complemento lo cobra el checkout
 * desde el siguiente pago; el de un paquete vive en plan_prices
 * (updatePlanPrice). Lo ya comprado no cambia.
 */
export async function updateCatalogItem(
  kind: "plan" | "addon",
  key: string,
  name: string,
  rawPrice: string,
  isActive: boolean,
  reason: string
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!can(admin, "planes.write")) return { ok: false, message: NO_PERMISSION };
  if (kind !== "plan" && kind !== "addon") return { ok: false, message: "Tipo no válido." };
  if (!name.trim()) return { ok: false, message: "El nombre no puede quedar vacío." };
  if (reason.trim().length < 3) return { ok: false, message: "Escribe un motivo (mínimo 3 caracteres)." };

  const supabase = await createClient();
  const { data: current, error: readError } = await supabase
    .from(kind === "plan" ? "plans" : "addons")
    .select("name, price_cents, stripe_product_id, is_active")
    .eq("key", key)
    .maybeSingle();
  if (readError || !current) return { ok: false, message: kind === "plan" ? "No se encontró el paquete." : "No se encontró el complemento." };

  let price: number | null;
  if (kind === "plan") {
    // update_catalog_item exige precio en paquetes: se reenvía el que ya tiene
    // (plans.price_cents ya no se edita; el checkout cobra con plan_prices).
    price = current.price_cents;
    if (isActive && !current.is_active) {
      // Sin un tramo vigente o futuro en plan_prices el checkout responde price_unavailable.
      const { count } = await supabase
        .from("plan_prices")
        .select("id", { count: "exact", head: true })
        .eq("plan_key", key)
        .or(`valid_until.is.null,valid_until.gte.${new Date().toISOString()}`);
      if (!count) return { ok: false, message: "Este paquete no tiene precio vigente: el checkout no lo podría cobrar. No se activó." };
    }
  } else {
    const parsed = parsePriceCents(rawPrice);
    if (parsed === "invalid") return { ok: false, message: INVALID_PRICE };
    price = parsed;
  }

  // Con Product en Stripe, el checkout y el recibo usan el nombre del Product:
  // se renombra primero y, si Stripe falla, no se guarda nada.
  const productId: string | null = current.stripe_product_id;
  const renamed = productId !== null && current.name !== name.trim();
  if (renamed) {
    try {
      await renameStripeProduct(productId, name.trim());
    } catch (stripeError) {
      return { ok: false, message: stripeErrorMessage(stripeError) };
    }
  }

  const { error } = await supabase.rpc("update_catalog_item", {
    p_kind: kind,
    p_key: key,
    p_name: name.trim(),
    p_price_cents: price,
    p_is_active: isActive,
    p_reason: reason.trim(),
  });
  if (error && renamed) {
    const undo = await renameStripeProduct(productId, current.name).then(
      () => "",
      (undoError) => ` Además Stripe quedó con el nombre nuevo (${stripeErrorMessage(undoError)}).`
    );
    if (undo) return { ok: false, message: `No se guardó: ${dbError(error)}${undo}` };
  }
  if (error) {
    if (error.code === "42501") return { ok: false, message: NO_PERMISSION };
    if (error.code === "PGRST202" || /could not find the function/i.test(error.message)) {
      return { ok: false, message: "Falta aplicar la migración 20260929160000_super_admin_tools.sql en Supabase." };
    }
    return { ok: false, message: dbError(error) };
  }
  refresh();
  return { ok: true, message: `${name.trim()}: guardado.` };
}

/**
 * Precio de un tramo de plan_prices: lo que cobra el checkout de Celebraloo
 * desde el siguiente pago. Solo el precio; las vigencias no se tocan aquí.
 * La BD exige planes.write y guarda antes/después y el motivo en Actividad.
 */
export async function updatePlanPrice(id: string, rawPrice: string, reason: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!can(admin, "planes.write")) return { ok: false, message: NO_PERMISSION };
  if (reason.trim().length < 3) return { ok: false, message: "Escribe un motivo (mínimo 3 caracteres)." };
  const price = parsePriceCents(rawPrice);
  if (price === "invalid" || price === null) return { ok: false, message: INVALID_PRICE };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_plan_price", { p_id: id, p_price_cents: price, p_reason: reason.trim() });
  if (error) {
    if (error.code === "42501") return { ok: false, message: NO_PERMISSION };
    if (error.code === "PGRST202" || /could not find the function/i.test(error.message)) {
      return { ok: false, message: "Falta aplicar la migración 20261107110000_update_plan_price.sql en Supabase." };
    }
    if (error.code === "P0002") return { ok: false, message: "Ese precio ya no existe. Recarga la página." };
    // plan_prices_unique (plan_key, price_cents, valid_from).
    if (error.code === "23505") return { ok: false, message: "Ese paquete ya tiene ese mismo precio con la misma vigencia." };
    return { ok: false, message: dbError(error) };
  }
  refresh();
  return { ok: true, message: "Precio guardado." };
}
