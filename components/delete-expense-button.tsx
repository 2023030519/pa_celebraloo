"use client";

import { useRouter } from "next/navigation";
import { deleteExpense } from "@/app/(admin)/gastos/actions";
import { ConfirmAction } from "@/components/confirm-action";

/** Borrar cambia Finanzas: pide motivo, que queda en Actividad. redirectTo: adónde ir tras borrar (la ficha ya no existe). */
export function DeleteExpenseButton({ id, redirectTo }: { id: string; redirectTo?: string }) {
  const router = useRouter();
  return (
    <ConfirmAction
      label="Borrar"
      confirmLabel="Borrar gasto"
      tone="danger"
      size="sm"
      description="El gasto se borra de Finanzas y Reportes. Antes y después quedan en Actividad."
      onConfirm={async (reason) => {
        const result = await deleteExpense(id, reason);
        if (result.ok && redirectTo) router.replace(redirectTo);
        return result;
      }}
    />
  );
}
