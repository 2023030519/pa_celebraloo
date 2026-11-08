"use client";

import { setAccountSuspended } from "@/app/(admin)/clientes/actions";
import { ConfirmAction } from "@/components/confirm-action";

/** Suspender o reactivar una cuenta: con confirmación y motivo. */
export function AccountToggle({ userId, disabled }: { userId: string; disabled: boolean }) {
  return disabled ? (
    <ConfirmAction
      size="sm"
      label="Reactivar"
      confirmLabel="Reactivar cuenta"
      tone="ok"
      description="Podrá volver a iniciar sesión."
      onConfirm={(reason) => setAccountSuspended(userId, false, reason)}
    />
  ) : (
    <ConfirmAction
      size="sm"
      label="Suspender"
      confirmLabel="Suspender cuenta"
      tone="danger"
      description="No podrá iniciar sesión (una sesión abierta dura hasta 1 h). Sus eventos e invitaciones no se tocan."
      onConfirm={(reason) => setAccountSuspended(userId, true, reason)}
    />
  );
}
