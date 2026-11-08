"use client";

import { useId, useState, useTransition } from "react";
import { setStaffRole, type ActionResult } from "@/app/(admin)/usuarios/actions";
import { ADMIN_ROLES, ROLE_LABELS, type AdminRole } from "@/lib/auth/permissions";
import { RoleScope } from "@/components/role-cell";
import { Select, cn, ui } from "@/components/ui";

/** Cambiar el rol del panel. El motivo es obligatorio y queda en Actividad. */
export function RoleSelect({ userId, role }: { userId: string; role: AdminRole | null }) {
  const [next, setNext] = useState<AdminRole | "">(role ?? "");
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const changed = (next || null) !== role;
  const id = useId();

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-[13px] font-medium text-ink-800">Rol en el panel</span>
        <Select
          value={next}
          disabled={pending}
          onChange={(event) => {
            setNext(event.target.value as AdminRole | "");
            setResult(null);
          }}
          className="w-full sm:max-w-sm"
        >
          {ADMIN_ROLES.map((value) => (
            <option key={value} value={value}>
              {ROLE_LABELS[value]}
            </option>
          ))}
          <option value="">Sin acceso al panel</option>
        </Select>
      </label>
      {next ? <RoleScope role={next} /> : <p className="text-[13px] text-ink-600">No puede entrar al panel.</p>}
      {changed && (
        <div className="flex flex-col gap-2 border-t border-ink-150 pt-3">
          <label htmlFor={`${id}-reason`} className="text-[13px] font-medium text-ink-800">
            Motivo
          </label>
          <input
            id={`${id}-reason`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            aria-describedby={`${id}-hint`}
            className={cn(ui.field, "w-full max-md:h-11")}
          />
          <p id={`${id}-hint`} className="text-xs text-ink-600">
            Obligatorio, mínimo 3 caracteres. Queda en Actividad junto con el cambio.
          </p>
          <button
            type="button"
            disabled={pending || reason.trim().length < 3}
            onClick={() =>
              startTransition(async () => {
                const outcome = await setStaffRole(userId, next || null, reason);
                setResult(outcome);
                if (outcome.ok) setReason("");
              })
            }
            className={cn(ui.buttonPrimary, "self-start max-md:self-stretch")}
          >
            {pending ? "Guardando…" : "Guardar rol"}
          </button>
        </div>
      )}
      <p aria-live="polite" className="text-xs empty:-mt-3">
        {!pending && result && <span className={result.ok ? "text-ok-700" : "text-danger-700"}>{result.message}</span>}
      </p>
    </div>
  );
}
