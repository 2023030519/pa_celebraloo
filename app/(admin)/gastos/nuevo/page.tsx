import { requireSuperAdmin } from "@/lib/auth/require-admin";
import { todayMx } from "@/lib/format";
import { PageTitle } from "@/components/ui";
import { ExpenseForm } from "@/components/expense-form";

export default async function NewExpensePage() {
  await requireSuperAdmin();
  return (
    <>
      <PageTitle title="Registrar gasto" />
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
