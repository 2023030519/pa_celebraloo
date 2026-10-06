"use client";

import { setPromotionActive } from "@/app/(admin)/promociones/actions";
import { ConfirmAction } from "@/components/confirm-action";

export function PromotionStatusAction({ id, active }: { id: string; active: boolean }) {
  return active ? (
    <ConfirmAction
      size="sm"
      label="Desactivar"
      confirmLabel="Desactivar código"
      tone="danger"
      description="El código deja de funcionar en Stripe de inmediato. Las ventas ya hechas no cambian."
      onConfirm={(reason) => setPromotionActive(id, false, reason)}
    />
  ) : (
    <ConfirmAction
      size="sm"
      label="Activar"
      confirmLabel="Activar código"
      tone="ok"
      description="El código vuelve a funcionar (si ya pasó su fecha de inicio)."
      onConfirm={(reason) => setPromotionActive(id, true, reason)}
    />
  );
}
