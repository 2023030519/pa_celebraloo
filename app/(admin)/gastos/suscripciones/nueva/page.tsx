import { requirePermission } from "@/lib/auth/require-admin";
import { todayMx } from "@/lib/format";
import { PageTitle } from "@/components/ui";
import { RecurringExpenseForm } from "@/components/recurring-expense-form";

export default async function NewSubscriptionPage() {
  await requirePermission("gastos.write");
  const today = todayMx();
  return (
    <>
      <PageTitle title="Nueva suscripción" subtitle="Un servicio que se cobra cada mes o cada año." />
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
