"use server";

import { refresh } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { parsePesosToCents } from "@/lib/format";

export type ActionResult = { ok: boolean; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Configuración y apartados: con la sesión de la superadmin (RLS). La
 * bitácora la escribe un trigger en la BD (antes/después).
 */
export type SettingsInput = {
  supportEmail: string;
  companyName: string;
  companyLegalName: string;
  companyRfc: string;
  companyAddress: string;
  ivaPercent: string;
  upcomingDays: string;
};

export async function saveSettings(input: SettingsInput): Promise<ActionResult> {
  const admin = await requireSuperAdmin();
  const email = input.supportEmail.trim();
  if (email && !EMAIL.test(email)) return { ok: false, message: "El email de soporte no es válido." };
  if (!input.companyName.trim()) return { ok: false, message: "El nombre de Celebraloo no puede quedar vacío." };
  // "16" o "16.5" → puntos base (1600 / 1650), sin floats.
  const ivaBps = parsePesosToCents(input.ivaPercent);
  if (ivaBps === null || ivaBps > 10000) return { ok: false, message: "IVA no válido. Usa un porcentaje entre 0 y 100, p. ej. 16." };
  const days = Number(input.upcomingDays);
  if (!Number.isInteger(days) || days < 1 || days > 365) return { ok: false, message: "Los días para “Próximo” van de 1 a 365." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("admin_settings")
    .update({
      support_email: email || null,
      company_name: input.companyName.trim().slice(0, 120),
      company_legal_name: input.companyLegalName.trim().slice(0, 200) || null,
      company_rfc: input.companyRfc.trim().toUpperCase().slice(0, 13) || null,
      company_address: input.companyAddress.trim().slice(0, 500) || null,
      iva_rate_bps: ivaBps,
      upcoming_event_days: days,
      updated_by: admin.userId,
    })
    .eq("id", true);
  if (error) return { ok: false, message: error.message };
  refresh();
  return { ok: true, message: "Configuración guardada. La nueva tasa de IVA aplica solo a ventas nuevas." };
}

export type RuleInput = { name: string; kind: string; value: string; base: string; isActive: boolean };

export async function saveRule(id: string | null, input: RuleInput): Promise<ActionResult> {
  await requireSuperAdmin();
  if (id !== null && !UUID.test(id)) return { ok: false, message: "Apartado no válido." };
  if (!input.name.trim()) return { ok: false, message: "Ponle nombre al apartado." };
  if (input.kind !== "percent" && input.kind !== "fixed") return { ok: false, message: "Elige porcentaje o monto fijo." };
  // Porcentaje → puntos base; monto fijo → centavos. Mismo parser de 2 decimales.
  const value = parsePesosToCents(input.value);
  if (value === null) return { ok: false, message: input.kind === "percent" ? "Porcentaje no válido, p. ej. 10 o 12.5." : "Monto no válido, p. ej. 5000." };
  if (input.kind === "percent" && value > 10000) return { ok: false, message: "El porcentaje no puede pasar de 100." };
  const base = input.kind === "percent" ? input.base : null;
  if (input.kind === "percent" && !["ventas_sin_iva", "dinero_recibido", "resultado_operativo"].includes(input.base)) {
    return { ok: false, message: "Elige sobre qué se calcula el porcentaje." };
  }

  const row = { name: input.name.trim().slice(0, 80), kind: input.kind, value, base, is_active: input.isActive };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("admin_set_aside_rules").update(row).eq("id", id)
    : await supabase.from("admin_set_aside_rules").insert({ ...row, sort_order: 100 });
  if (error) return { ok: false, message: error.message };
  refresh();
  return { ok: true, message: `${row.name}: guardado.` };
}

export async function deleteRule(id: string): Promise<ActionResult> {
  await requireSuperAdmin();
  if (!UUID.test(id)) return { ok: false, message: "Apartado no válido." };
  const supabase = await createClient();
  const { error } = await supabase.from("admin_set_aside_rules").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  refresh();
  return { ok: true, message: "Apartado borrado." };
}
