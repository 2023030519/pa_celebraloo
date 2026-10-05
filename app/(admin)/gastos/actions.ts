"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { EXPENSE_CATEGORIES, parsePesosToCents } from "@/lib/format";

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
  if (!input.concept.trim()) return { error: "Escribe el concepto." };
  if (!(input.category in EXPENSE_CATEGORIES)) return { error: "Elige una categoría." };
  if (input.expenseType !== "fijo" && input.expenseType !== "variable") return { error: "Elige fijo o variable." };
  if (!["unico", "mensual", "anual"].includes(input.periodicity)) return { error: "Elige la periodicidad." };
  const subtotal = parsePesosToCents(input.subtotal);
  if (subtotal === null) return { error: "Subtotal no válido. Usa pesos, p. ej. 1500 o 1500.50." };
  const tax = input.tax.trim() === "" ? 0 : parsePesosToCents(input.tax);
  if (tax === null) return { error: "IVA no válido. Usa pesos, p. ej. 240 o déjalo vacío." };

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
  const admin = await requireSuperAdmin();
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

export async function deleteExpense(id: string): Promise<ActionResult> {
  await requireSuperAdmin();
  if (!UUID.test(id)) return { ok: false, message: "Gasto no válido." };
  const supabase = await createClient();
  const { error } = await supabase.from("admin_expenses").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  refresh();
  return { ok: true, message: "Gasto borrado." };
}
