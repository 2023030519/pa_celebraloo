"use server";

import { refresh } from "next/cache";
import { can, NO_PERMISSION, requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: boolean; message: string };

/** "299", "1,990.50", "" → centavos. "" solo vale para complementos (precio pendiente). */
function parsePriceCents(raw: string): number | null | "invalid" {
  const clean = raw.replace(/[$,\s]/g, "");
  if (clean === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return "invalid";
  return Math.round(Number(clean) * 100);
}

/**
 * Nombre, precio y activo de un paquete o complemento. Va por RPC con la
 * sesión del superadmin: la BD valida el rol y guarda antes/después en
 * Actividad. El checkout de Celebraloo cobra con este precio desde el
 * siguiente pago; lo ya comprado no cambia.
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

  const price = parsePriceCents(rawPrice);
  if (price === "invalid") return { ok: false, message: "Precio no válido. Usa pesos, p. ej. 299 o 1990.50." };
  if (kind === "plan" && price === null) return { ok: false, message: "Un paquete necesita precio." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_catalog_item", {
    p_kind: kind,
    p_key: key,
    p_name: name.trim(),
    p_price_cents: price,
    p_is_active: isActive,
    p_reason: reason.trim(),
  });
  if (error) {
    if (error.code === "42501") return { ok: false, message: NO_PERMISSION };
    if (error.code === "PGRST202" || /could not find the function/i.test(error.message)) {
      return { ok: false, message: "Falta aplicar la migración 20260929160000_super_admin_tools.sql en Supabase." };
    }
    return { ok: false, message: error.message };
  }
  refresh();
  return { ok: true, message: `${name.trim()}: guardado.` };
}
