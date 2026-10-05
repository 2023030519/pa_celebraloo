"use client";

import { setRecurringStatus } from "@/app/(admin)/gastos/actions";
import { ConfirmAction } from "@/components/confirm-action";

/** Cancelar (deja de generar cobros) o reactivar una suscripción, con motivo. */
export function SubscriptionStatusAction({ id, status }: { id: string; status: "activo" | "cancelado" }) {
  return status === "activo" ? (
    <ConfirmAction
      size="sm"
      label="Cancelar"
      confirmLabel="Cancelar suscripción"
      tone="danger"
      description="Deja de registrar cobros desde hoy. Los gastos ya registrados se quedan."
      onConfirm={(reason) => setRecurringStatus(id, "cancelado", reason)}
    />
  ) : (
    <ConfirmAction
      size="sm"
      label="Reactivar"
      confirmLabel="Reactivar suscripción"
      tone="ok"
      description="Vuelve a registrar cobros desde la próxima fecha de cobro."
      onConfirm={(reason) => setRecurringStatus(id, "activo", reason)}
    />
  );
}
