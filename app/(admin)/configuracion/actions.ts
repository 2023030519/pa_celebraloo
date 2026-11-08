"use server";

import { refresh } from "next/cache";
import { requirePermission } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { parsePesosToCents } from "@/lib/format";

export type ActionResult = { ok: boolean; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// shortcut: misma regla que rfcKind de Celebraloo/lib/billing/rfc.ts (moral 3 letras, física 4); si cambia allá, cambia aquí.
const RFC = /^[A-ZÑ&]{3,4}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[A-Z0-9]{3}$/;

/**
 * Configuración y apartados: por RPC con la sesión de quien edita. La BD
 * valida config.write, guarda el motivo en la bitácora (antes/después) y no
 * escribe nada si ningún valor cambió.
 */
function rpcError(error: { code?: string; message: string }): string {
  if (error.code === "42501") return "Tu rol no puede editar la configuración.";
  if (error.code === "22023") return "Escribe un motivo (mínimo 3 caracteres).";
  if (error.code === "P0002") return "Ese apartado ya no existe. Recarga la página.";
  if (error.code === "PGRST202" || /could not find the function/i.test(error.message)) {
    return "Falta aplicar la migración 20261107303000_motivo_gastos_y_configuracion.sql en Supabase.";
  }
  console.error("[configuracion]", error);
  return "No se pudo guardar: algún valor no es válido. Revisa los campos.";
}

const reasonError = (reason: string) => (reason.trim().length < 3 ? "Escribe un motivo (mínimo 3 caracteres)." : null);

export type SettingsInput = {
  supportEmail: string;
  companyName: string;
  companyLegalName: string;
  companyRfc: string;
  companyAddress: string;
  ivaPercent: string;
  upcomingDays: string;
};

export async function saveSettings(input: SettingsInput, reason: string): Promise<ActionResult> {
  await requirePermission("config.write");
  const missingReason = reasonError(reason);
  if (missingReason) return { ok: false, message: missingReason };
  const email = input.supportEmail.trim();
  if (email && !EMAIL.test(email)) return { ok: false, message: "El email de soporte no es válido." };
  if (!input.companyName.trim()) return { ok: false, message: "El nombre de Celebraloo no puede quedar vacío." };
  const rfc = input.companyRfc.trim().toUpperCase();
  if (rfc && !RFC.test(rfc)) return { ok: false, message: "RFC no válido: 12 caracteres (persona moral) o 13 (física), p. ej. ABC010203XY1." };
  // "16" o "16.5" → puntos base (1600 / 1650), sin floats.
  const ivaBps = parsePesosToCents(input.ivaPercent);
  if (ivaBps === null || ivaBps > 10000) return { ok: false, message: "IVA no válido. Usa un porcentaje entre 0 y 100, p. ej. 16." };
  const days = Number(input.upcomingDays);
  if (!Number.isInteger(days) || days < 1 || days > 365) return { ok: false, message: "Los días para “Próximo” van de 1 a 365." };

  const supabase = await createClient();
  const { data: changed, error } = await supabase.rpc("admin_save_settings", {
    p_data: {
      support_email: email,
      company_name: input.companyName.trim().slice(0, 120),
      company_legal_name: input.companyLegalName.trim().slice(0, 200),
      company_rfc: rfc,
      company_address: input.companyAddress.trim().slice(0, 500),
      iva_rate_bps: ivaBps,
      upcoming_event_days: days,
    },
    p_reason: reason.trim(),
  });
  if (error) return { ok: false, message: rpcError(error) };
  if (!changed) return { ok: true, message: "No cambió ningún valor: no se guardó nada." };
  refresh();
  return { ok: true, message: "Configuración guardada. La nueva tasa de IVA aplica solo a ventas nuevas." };
}

export type RuleInput = { name: string; kind: string; value: string; base: string; isActive: boolean };

export async function saveRule(id: string | null, input: RuleInput, reason: string): Promise<ActionResult> {
  await requirePermission("config.write");
  if (id !== null && !UUID.test(id)) return { ok: false, message: "Apartado no válido." };
  const missingReason = reasonError(reason);
  if (missingReason) return { ok: false, message: missingReason };
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
  const { data: savedId, error } = await supabase.rpc("admin_save_set_aside_rule", { p_id: id, p_data: row, p_reason: reason.trim() });
  if (error) return { ok: false, message: rpcError(error) };
  if (!savedId) return { ok: true, message: "No cambió ningún valor: no se guardó nada." };
  refresh();
  return { ok: true, message: `${row.name}: guardado.` };
}

export async function deleteRule(id: string, reason: string): Promise<ActionResult> {
  await requirePermission("config.write");
  if (!UUID.test(id)) return { ok: false, message: "Apartado no válido." };
  const missingReason = reasonError(reason);
  if (missingReason) return { ok: false, message: missingReason };
  const supabase = await createClient();
  // p_data null = borrar.
  const { error } = await supabase.rpc("admin_save_set_aside_rule", { p_id: id, p_data: null, p_reason: reason.trim() });
  if (error) return { ok: false, message: rpcError(error) };
  refresh();
  return { ok: true, message: "Apartado borrado." };
}
