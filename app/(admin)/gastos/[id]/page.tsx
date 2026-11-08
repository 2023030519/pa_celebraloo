import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { centsToInput, formatMxn } from "@/lib/format";
import { PageTitle, formatDate } from "@/components/ui";
import { ExpenseForm } from "@/components/expense-form";
import { DeleteExpenseButton } from "@/components/delete-expense-button";

export const metadata: Metadata = { title: "Gasto" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("gastos.write");
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const { data: expense } = await supabase.from("admin_expenses").select("*").eq("id", id).maybeSingle();
  if (!expense) notFound();

  return (
    <>
      <PageTitle
        breadcrumb={[{ href: "/gastos", label: "Gastos" }]}
        title={`Editar gasto: ${expense.concept}`}
        subtitle={
          <>
            <span className="font-medium text-ink-950 tabular-nums">{formatMxn(expense.total_cents)}</span> con IVA · registrado{" "}
            {formatDate(expense.created_at, true)}
          </>
        }
        // Borrar vive en la ficha, no en cada fila de la lista; al borrar vuelve al mes del gasto.
        actions={<DeleteExpenseButton id={id} redirectTo={`/gastos?mes=${String(expense.expense_date).slice(0, 7)}`} />}
      />
      <ExpenseForm
        id={id}
        initial={{
          expenseDate: expense.expense_date,
          concept: expense.concept,
          category: expense.category,
          vendor: expense.vendor ?? "",
          subtotal: centsToInput(expense.subtotal_cents),
          tax: expense.tax_cents ? centsToInput(expense.tax_cents) : "",
          expenseType: expense.expense_type,
          periodicity: expense.periodicity,
          paymentMethod: expense.payment_method ?? "",
          notes: expense.notes ?? "",
        }}
      />
    </>
  );
}
