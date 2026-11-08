import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/require-admin";
import { todayMx } from "@/lib/format";
import { PageTitle } from "@/components/ui";
import { ExpenseForm } from "@/components/expense-form";

export const metadata: Metadata = { title: "Registrar gasto" };

export default async function NewExpensePage() {
  await requirePermission("gastos.write");
  return (
    <>
      <PageTitle breadcrumb={[{ href: "/gastos", label: "Gastos" }]} title="Registrar gasto" subtitle="Cuenta en Finanzas por su fecha." />
      <ExpenseForm
        id={null}
        initial={{
          expenseDate: todayMx(),
          concept: "",
          category: "",
          vendor: "",
          subtotal: "",
          tax: "",
          expenseType: "variable",
          periodicity: "unico",
          paymentMethod: "",
          notes: "",
        }}
      />
    </>
  );
}
