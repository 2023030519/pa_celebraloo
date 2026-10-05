"use client";

import { useState, useTransition } from "react";
import { setStaffRole, type ActionResult } from "@/app/(admin)/usuarios/actions";
import { ADMIN_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type AdminRole } from "@/lib/auth/permissions";
import { cn } from "@/components/ui";

const inputClass =
  "h-9 rounded-md border border-ink-250 bg-surface px-2.5 outline-none focus:border-gold-600 focus:ring-2 focus:ring-gold-600/30 disabled:opacity-50";

/** Cambiar el rol del panel. El motivo es obligatorio y queda en Actividad. */
export function RoleSelect({ userId, role }: { userId: string; role: AdminRole | null }) {
  const [next, setNext] = useState<AdminRole | "">(role ?? "");
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const changed = (next || null) !== role;

  return (
    <div className="flex flex-col gap-2">
      <select
        aria-label="Rol en el panel"
        value={next}
        disabled={pending}
        onChange={(event) => {
          setNext(event.target.value as AdminRole | "");
          setResult(null);
        }}
        className={inputClass}
      >
        {ADMIN_ROLES.map((value) => (
          <option key={value} value={value}>
            {ROLE_LABELS[value]}
          </option>
        ))}
        <option value="">Sin acceso al panel</option>
      </select>
      <p className="text-xs text-ink-600">{next ? ROLE_DESCRIPTIONS[next] : "No puede entrar al panel."}</p>
      {changed && (
        <>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            placeholder="Motivo del cambio (obligatorio)"
            aria-label="Motivo del cambio de rol"
            className={cn(inputClass, "w-full")}
          />
          <button
            disabled={pending || reason.trim().length < 3}
            onClick={() =>
              startTransition(async () => {
                const outcome = await setStaffRole(userId, next || null, reason);
                setResult(outcome);
                if (outcome.ok) setReason("");
              })
            }
            className="inline-flex h-9 items-center justify-center rounded-md bg-ink-950 px-3 font-semibold text-surface hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Guardar rol
          </button>
        </>
      )}
      <p aria-live="polite" className="min-h-4 text-xs">
        {pending && <span className="text-ink-600">Guardando…</span>}
        {!pending && result && <span className={result.ok ? "text-ok-700" : "text-danger-700"}>{result.message}</span>}
      </p>
    </div>
  );
}
