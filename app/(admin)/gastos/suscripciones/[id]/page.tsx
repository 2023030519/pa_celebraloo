import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { centsToInput } from "@/lib/format";
import { PageTitle } from "@/components/ui";
import { RecurringExpenseForm } from "@/components/recurring-expense-form";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditSubscriptionPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("gastos.write");
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const { data: row } = await supabase.from("admin_recurring_expenses").select("*").eq("id", id).maybeSingle();
  if (!row) notFound();

  return (
    <>
      <PageTitle
        title={`Editar: ${row.concept}`}
        subtitle={
          row.status === "cancelado"
            ? "Cancelada: no genera cobros. Ajusta la próxima fecha y reactívala desde la lista."
            : "Si cambias la próxima fecha o la periodicidad, el calendario de cobros empieza de nuevo desde esa fecha."
        }
      />
      <RecurringExpenseForm
        id={row.id}
        initial={{
          concept: row.concept,
          category: row.category,
          vendor: row.vendor ?? "",
          subtotal: centsToInput(row.subtotal_cents),
          tax: row.tax_cents ? centsToInput(row.tax_cents) : "",
          periodicity: row.periodicity,
          startDate: row.start_date,
          nextChargeDate: row.next_charge_date,
          paymentMethod: row.payment_method ?? "",
          notes: row.notes ?? "",
        }}
      />
    </>
  );
}
