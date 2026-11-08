import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CircleSlash } from "lucide-react";
import { requirePermission } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { centsToInput } from "@/lib/format";
import { Badge, HowCalculated, PageTitle } from "@/components/ui";
import { SubscriptionStatusAction } from "@/components/subscription-status-action";
import { RecurringExpenseForm } from "@/components/recurring-expense-form";

export const metadata: Metadata = { title: "Suscripción" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditSubscriptionPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("gastos.write");
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const { data: row } = await supabase.from("admin_recurring_expenses").select("*").eq("id", id).maybeSingle();
  if (!row) notFound();
  const cancelled = row.status === "cancelado";

  return (
    <>
      <PageTitle
        breadcrumb={[
          { href: "/gastos", label: "Gastos" },
          { href: "/gastos/suscripciones", label: "Suscripciones y servicios" },
        ]}
        title={`Editar: ${row.concept}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {cancelled ? (
              <Badge>
                <CircleSlash size={12} aria-hidden="true" />
                Cancelada
              </Badge>
            ) : (
              // R22: activa es lo normal, va como texto; solo la cancelada lleva chip.
              <span>Activa</span>
            )}
            {cancelled && <span>No genera cobros. Ajusta la próxima fecha y luego reactívala.</span>}
          </span>
        }
        actions={<SubscriptionStatusAction id={row.id} status={cancelled ? "cancelado" : "activo"} />}
      />
      {!cancelled && (
        <HowCalculated className="-mt-3 mb-4">
          <p>Si cambias la próxima fecha o la periodicidad, el calendario de cobros empieza de nuevo desde esa fecha.</p>
        </HowCalculated>
      )}
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
