import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { centsToInput, formatMxn } from "@/lib/format";
import { PageTitle, formatDate } from "@/components/ui";
import { ExpenseForm } from "@/components/expense-form";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const { data: expense } = await supabase.from("admin_expenses").select("*").eq("id", id).maybeSingle();
  if (!expense) notFound();

  return (
    <>
      <PageTitle
        title="Editar gasto"
        subtitle={`Total actual ${formatMxn(expense.total_cents)} · registrado ${formatDate(expense.created_at, true)}. Los cambios quedan en Actividad.`}
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
