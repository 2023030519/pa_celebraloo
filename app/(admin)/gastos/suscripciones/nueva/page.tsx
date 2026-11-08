import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/require-admin";
import { todayMx } from "@/lib/format";
import { PageTitle } from "@/components/ui";
import { RecurringExpenseForm } from "@/components/recurring-expense-form";

export const metadata: Metadata = { title: "Nueva suscripción" };

export default async function NewSubscriptionPage() {
  await requirePermission("gastos.write");
  const today = todayMx();
  return (
    <>
      <PageTitle
        breadcrumb={[
          { href: "/gastos", label: "Gastos" },
          { href: "/gastos/suscripciones", label: "Suscripciones y servicios" },
        ]}
        title="Nueva suscripción"
        subtitle="Un servicio que se cobra cada mes o cada año."
      />
      <RecurringExpenseForm
        id={null}
        initial={{
          concept: "",
          category: "",
          vendor: "",
          subtotal: "",
          tax: "",
          periodicity: "mensual",
          startDate: today,
          nextChargeDate: today,
          paymentMethod: "",
          notes: "",
        }}
      />
    </>
  );
}
