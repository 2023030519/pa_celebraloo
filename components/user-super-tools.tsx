"use client";

import { useId, useState, useTransition } from "react";
import { Gift, ShieldCheck, Trash2 } from "lucide-react";
import { deleteAccount, resetFreePlan, type ActionResult } from "@/app/(admin)/usuarios/actions";
import { RoleSelect } from "@/components/role-select";
import { cn, ui } from "@/components/ui";
import type { AdminRole } from "@/lib/auth/permissions";

const heading = "flex items-center gap-1.5 text-[13px] font-semibold text-ink-950";

/** Rol, prueba gratis y borrado, apilados al final de la ficha (secciones con divisor, sin tarjetas). */
export function UserSuperTools({
  userId,
  email,
  role,
  isSelf,
  freePlanUsed,
  canEditRole,
  canResetFreePlan,
  canDelete,
}: {
  userId: string;
  email: string;
  role: AdminRole | null;
  isSelf: boolean;
  freePlanUsed: boolean | null;
  canEditRole: boolean;
  canResetFreePlan: boolean;
  canDelete: boolean;
}) {
  const [reason, setReason] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const reasonReady = reason.trim().length >= 3;
  const id = useId();
  // Borrar la propia cuenta no se ofrece, así que ahí el motivo compartido solo sirve a la prueba gratis.
  const needsReason = canResetFreePlan || (canDelete && !isSelf);

  const run = (action: () => Promise<ActionResult>) => {
    setResult(null);
    startTransition(async () => {
      setResult(await action());
    });
  };

  return (
    <div className="flex flex-col divide-y divide-ink-150">
      {canEditRole && (
        <section className="flex flex-col gap-3 p-4">
          <h3 className={heading}>
            <ShieldCheck size={14} aria-hidden="true" className="text-ink-600" /> Rol en el panel
          </h3>
          <RoleSelect userId={userId} role={role} />
        </section>
      )}

      {needsReason && (
        <div className="flex flex-col gap-1 p-4">
          <label htmlFor={`${id}-reason`} className="text-[13px] font-medium text-ink-800">
            Motivo
          </label>
          <input
            id={`${id}-reason`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            placeholder="Ej.: se equivocó de correo al registrarse"
            aria-describedby={`${id}-hint`}
            className={cn(ui.field, "w-full max-md:h-11")}
          />
          <p id={`${id}-hint`} className="text-xs text-ink-600">
            Para devolver la prueba gratis o borrar la cuenta. Mínimo 3 caracteres; queda en Actividad.
          </p>
          <p aria-live="polite" className="text-[13px] empty:-mt-1">
            {pending && <span className="text-ink-600">Aplicando…</span>}
            {!pending && result && <span className={result.ok ? "text-ok-700" : "text-danger-700"}>{result.message}</span>}
          </p>
        </div>
      )}

      {canResetFreePlan && (
        <section className="flex flex-col gap-2 p-4">
          <h3 className={heading}>
            <Gift size={14} aria-hidden="true" className="text-ink-600" /> Prueba gratis
          </h3>
          <p className="text-[13px] text-ink-600">
            {freePlanUsed === null
              ? "No se pudo consultar (¿falta la migración de la prueba gratis?)."
              : freePlanUsed
                ? "Este correo ya lo usó. Devolverlo le deja crear otro evento gratis."
                : "Este correo todavía no lo ha usado."}
          </p>
          <button
            type="button"
            disabled={pending || !reasonReady || freePlanUsed === false}
            onClick={() => run(() => resetFreePlan(email, reason))}
            className={cn(ui.buttonSecondary, "self-start max-md:self-stretch")}
          >
            Devolver prueba gratis
          </button>
        </section>
      )}

      {canDelete && (
        <section className="flex flex-col gap-2 p-4">
          <h3 className={cn(heading, "text-danger-700")}>
            <Trash2 size={14} aria-hidden="true" /> Borrar cuenta
          </h3>
          {isSelf ? (
            <p className="text-[13px] text-ink-600">No puedes borrar tu propia cuenta.</p>
          ) : (
            <>
              <p className="text-[13px] text-ink-600">
                Permanente. Solo si no es dueña de eventos (bórralos antes). Escribe el correo para confirmar.
              </p>
              <input
                value={confirmEmail}
                onChange={(event) => setConfirmEmail(event.target.value)}
                placeholder={email}
                aria-label="Correo de la cuenta"
                autoComplete="off"
                className={cn(ui.field, "w-full max-md:h-11")}
              />
              <button
                type="button"
                disabled={pending || !reasonReady || confirmEmail.trim().toLowerCase() !== email.toLowerCase()}
                onClick={() => run(() => deleteAccount(userId, confirmEmail, reason))}
                className={cn(ui.buttonDanger, "self-start max-md:self-stretch")}
              >
                Borrar para siempre
              </button>
            </>
          )}
        </section>
      )}
    </div>
  );
}
