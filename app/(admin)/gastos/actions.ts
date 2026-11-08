"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { requirePermission } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { EXPENSE_CATEGORIES, addDays, expenseDateRange, formatDay, parsePesosToCents, todayMx } from "@/lib/format";

export type ExpenseInput = {
  expenseDate: string;
  concept: string;
  category: string;
  vendor: string;
  subtotal: string;
  tax: string;
  expenseType: string;
  periodicity: string;
  paymentMethod: string;
  notes: string;
};

export type ActionResult = { ok: boolean; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Gastos: van con la sesión de la superadmin (RLS de admin_expenses). La
 * bitácora (antes/después) la escribe un trigger en la BD, así que ningún
 * cambio se la salta. total_cents lo calcula la BD (subtotal + IVA).
 */
function toRow(input: ExpenseInput): { row: Record<string, unknown> } | { error: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.expenseDate)) return { error: "Elige la fecha del gasto." };
  // addDays(…, 0) normaliza: "2026-02-30" se vuelve "2026-03-02" y no coincide.
  const range = expenseDateRange();
  if (addDays(input.expenseDate, 0) !== input.expenseDate || input.expenseDate < range.min || input.expenseDate > range.max) {
    return { error: `Fecha no válida: debe estar entre el ${formatDay(range.min)} y el ${formatDay(range.max)}.` };
  }
  if (!input.concept.trim()) return { error: "Escribe el concepto." };
  if (!(input.category in EXPENSE_CATEGORIES)) return { error: "Elige una categoría." };
  if (input.expenseType !== "fijo" && input.expenseType !== "variable") return { error: "Elige fijo o variable." };
  if (!["unico", "mensual", "anual"].includes(input.periodicity)) return { error: "Elige la periodicidad." };
  const subtotal = parsePesosToCents(input.subtotal);
  if (subtotal === null) return { error: "Subtotal no válido. Usa pesos y punto para los centavos, p. ej. 1500 o 1500.50." };
  if (subtotal === 0) return { error: "El subtotal debe ser mayor que 0." };
  const tax = input.tax.trim() === "" ? 0 : parsePesosToCents(input.tax);
  if (tax === null) return { error: "IVA no válido. Usa pesos y punto para los centavos (p. ej. 240.50) o déjalo vacío." };

  return {
    row: {
      expense_date: input.expenseDate,
      concept: input.concept.trim().slice(0, 300),
      category: input.category,
      vendor: input.vendor.trim().slice(0, 200) || null,
      subtotal_cents: subtotal,
      tax_cents: tax,
      expense_type: input.expenseType,
      periodicity: input.periodicity,
      payment_method: input.paymentMethod.trim().slice(0, 100) || null,
      notes: input.notes.trim().slice(0, 2000) || null,
    },
  };
}

export async function saveExpense(id: string | null, input: ExpenseInput): Promise<ActionResult> {
  const admin = await requirePermission("gastos.write");
  if (id !== null && !UUID.test(id)) return { ok: false, message: "Gasto no válido." };
  const parsed = toRow(input);
  if ("error" in parsed) return { ok: false, message: parsed.error };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("admin_expenses").update(parsed.row).eq("id", id)
    : await supabase.from("admin_expenses").insert({ ...parsed.row, created_by: admin.userId });
  if (error) return { ok: false, message: error.message };

  redirect(`/gastos?mes=${input.expenseDate.slice(0, 7)}`);
}

/** Va por RPC para que el motivo quede en la bitácora (migración 20261107303000). */
export async function deleteExpense(id: string, reason: string): Promise<ActionResult> {
  await requirePermission("gastos.write");
  if (!UUID.test(id)) return { ok: false, message: "Gasto no válido." };
  if (reason.trim().length < 3) return { ok: false, message: "Escribe un motivo (mínimo 3 caracteres)." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_expense", { p_id: id, p_reason: reason.trim() });
  if (error) {
    if (error.code === "P0002") return { ok: false, message: "Ese gasto ya no existe. Recarga la página." };
    if (error.code === "PGRST202" || /could not find the function/i.test(error.message)) {
      return { ok: false, message: "Falta aplicar la migración 20261107303000_motivo_gastos_y_configuracion.sql en Supabase." };
    }
    return { ok: false, message: recurringError(error) };
  }
  refresh();
  return { ok: true, message: "Gasto borrado." };
}

// ---------------------------------------------------------------------------
// Suscripciones y servicios (gastos recurrentes)
// ---------------------------------------------------------------------------

export type RecurringInput = {
  concept: string;
  category: string;
  vendor: string;
  subtotal: string;
  tax: string;
  periodicity: string;
  startDate: string;
  nextChargeDate: string;
  paymentMethod: string;
  notes: string;
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function toRecurringData(input: RecurringInput): { data: Record<string, unknown> } | { error: string } {
  if (!input.concept.trim()) return { error: "Escribe el servicio o concepto." };
  if (!(input.category in EXPENSE_CATEGORIES) || input.category === "retiro") return { error: "Elige una categoría (un retiro no es una suscripción)." };
  if (input.periodicity !== "mensual" && input.periodicity !== "anual") return { error: "Elige mensual o anual." };
  if (!ISO_DAY.test(input.startDate)) return { error: "Elige la fecha de inicio." };
  if (!ISO_DAY.test(input.nextChargeDate)) return { error: "Elige la próxima fecha de cobro." };
  if (input.nextChargeDate < input.startDate) return { error: "La próxima fecha de cobro no puede ser antes del inicio." };
  const subtotal = parsePesosToCents(input.subtotal);
  if (subtotal === null) return { error: "Subtotal no válido. Usa pesos y punto para los centavos, p. ej. 1500 o 1500.50." };
  const tax = input.tax.trim() === "" ? 0 : parsePesosToCents(input.tax);
  if (tax === null) return { error: "IVA no válido. Usa pesos y punto para los centavos (p. ej. 240.50) o déjalo vacío." };
  return {
    data: {
      concept: input.concept.trim().slice(0, 300),
      category: input.category,
      vendor: input.vendor.trim().slice(0, 200),
      subtotal_cents: subtotal,
      tax_cents: tax,
      periodicity: input.periodicity,
      start_date: input.startDate,
      next_charge_date: input.nextChargeDate,
      payment_method: input.paymentMethod.trim().slice(0, 100),
      notes: input.notes.trim().slice(0, 2000),
    },
  };
}

function recurringError(error: { code?: string; message: string }): string {
  if (error.code === "42501") return "Tu rol no puede editar gastos.";
  if (error.code === "22023") return "Escribe un motivo (mínimo 3 caracteres).";
  if (error.code === "PGRST202" || /could not find the function/i.test(error.message)) {
    return "Falta aplicar la migración 20261005150000_admin_clientes_gastos.sql en Supabase.";
  }
  return error.message;
}

/**
 * Alta o edición de una suscripción. Va por RPC: la BD valida el permiso,
 * guarda el motivo en la bitácora y registra el cobro si cae hoy. Una fecha
 * pasada no rellena hacia atrás: la BD la adelanta al primer cobro desde hoy
 * (migración 20261107220000_recurring_expense_no_backfill.sql).
 */
export async function saveRecurringExpense(id: string | null, input: RecurringInput, reason: string): Promise<ActionResult> {
  await requirePermission("gastos.write");
  if (id !== null && !UUID.test(id)) return { ok: false, message: "Suscripción no válida." };
  if (reason.trim().length < 3) return { ok: false, message: "Escribe un motivo (mínimo 3 caracteres)." };
  const parsed = toRecurringData(input);
  if ("error" in parsed) return { ok: false, message: parsed.error };

  const supabase = await createClient();
  let data = parsed.data;
  if (id) {
    // Conserva el estado actual (activo/cancelado) al editar.
    const { data: current } = await supabase.from("admin_recurring_expenses").select("status").eq("id", id).maybeSingle();
    data = { ...data, status: current?.status ?? "activo" };
  }
  const { error } = await supabase.rpc("admin_save_recurring_expense", { p_id: id, p_data: data, p_reason: reason.trim() });
  if (error) return { ok: false, message: recurringError(error) };
  redirect("/gastos/suscripciones");
}

/** Cancelar o reactivar: deja de generar (o vuelve a generar) cobros. */
export async function setRecurringStatus(id: string, status: "activo" | "cancelado", reason: string): Promise<ActionResult> {
  await requirePermission("gastos.write");
  if (!UUID.test(id)) return { ok: false, message: "Suscripción no válida." };
  const supabase = await createClient();
  const { data: row, error: readError } = await supabase.from("admin_recurring_expenses").select("*").eq("id", id).maybeSingle();
  if (readError || !row) return { ok: false, message: "Suscripción no encontrada." };
  // Reactivar con una fecha vencida rellenaría los meses en que estuvo cancelada.
  if (status === "activo" && row.next_charge_date < todayMx()) {
    return { ok: false, message: "La próxima fecha de cobro ya pasó: edítala con la fecha real del siguiente cobro y luego reactívala." };
  }
  const { error } = await supabase.rpc("admin_save_recurring_expense", {
    p_id: id,
    p_data: {
      concept: row.concept,
      category: row.category,
      vendor: row.vendor ?? "",
      subtotal_cents: row.subtotal_cents,
      tax_cents: row.tax_cents,
      periodicity: row.periodicity,
      start_date: row.start_date,
      next_charge_date: row.next_charge_date,
      payment_method: row.payment_method ?? "",
      notes: row.notes ?? "",
      status,
    },
    p_reason: reason.trim(),
  });
  if (error) return { ok: false, message: recurringError(error) };
  refresh();
  return { ok: true, message: status === "cancelado" ? "Suscripción cancelada: ya no generará cobros." : "Suscripción reactivada." };
}
