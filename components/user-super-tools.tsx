"use client";

import { useState, useTransition } from "react";
import { Gift, ShieldCheck, Trash2 } from "lucide-react";
import { deleteAccount, resetFreePlan, type ActionResult } from "@/app/(admin)/usuarios/actions";
import { RoleSelect } from "@/components/role-select";
import { cn } from "@/components/ui";
import type { AdminRole } from "@/lib/auth/permissions";

const inputClass =
  "h-9 rounded-md border border-ink-250 bg-surface px-2.5 outline-none focus:border-gold-600 focus:ring-2 focus:ring-gold-600/30 disabled:opacity-50";
const buttonClass =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-3 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40";
const cardClass = "flex flex-col gap-2 rounded-xl border border-ink-150 bg-surface p-4 shadow-sm";

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

  const run = (action: () => Promise<ActionResult>) => {
    setResult(null);
    startTransition(async () => {
      setResult(await action());
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-ink-800">
          Motivo <span className="font-normal text-ink-600">(para plan gratis y borrar; queda en Actividad)</span>
        </span>
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={500}
          placeholder="Ej.: se equivocó de correo al registrarse"
          className={cn(inputClass, "w-full max-w-xl")}
        />
      </label>
      <p aria-live="polite" className="min-h-5 text-[13px]">
        {pending && <span className="text-ink-600">Aplicando…</span>}
        {!pending && result && <span className={result.ok ? "text-ok-700" : "text-danger-700"}>{result.message}</span>}
      </p>

      <div className="grid gap-3 lg:grid-cols-3">
        {canEditRole && (
        <section className={cardClass}>
          <h3 className="flex items-center gap-1.5 text-[13px] font-semibold">
            <ShieldCheck size={14} aria-hidden="true" /> Rol en el panel
          </h3>
          <RoleSelect userId={userId} role={role} />
        </section>
        )}

        {canResetFreePlan && (
        <section className={cardClass}>
          <h3 className="flex items-center gap-1.5 text-[13px] font-semibold">
            <Gift size={14} aria-hidden="true" /> Recorrido gratuito
          </h3>
          <p className="text-xs text-ink-600">
            {freePlanUsed === null
              ? "No se pudo consultar (¿falta la migración del plan gratis?)."
              : freePlanUsed
                ? "Este correo ya lo usó. Devolverlo le deja crear otro evento gratis."
                : "Este correo todavía no lo ha usado."}
          </p>
          <button
            disabled={pending || !reasonReady || freePlanUsed === false}
            onClick={() => run(() => resetFreePlan(email, reason))}
            className={cn(buttonClass, "mt-auto bg-ink-950 text-surface hover:bg-ink-800")}
          >
            Devolver plan gratis
          </button>
        </section>
        )}

        {canDelete && (
        <section className={cn(cardClass, "border-danger-700/40 bg-danger-100/40")}>
          <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-danger-700">
            <Trash2 size={14} aria-hidden="true" /> Borrar cuenta
          </h3>
          {isSelf ? (
            <p className="text-xs text-ink-600">No puedes borrar tu propia cuenta.</p>
          ) : (
            <>
              <p className="text-xs text-ink-600">
                Permanente. Solo si no es dueña de eventos (bórralos antes). Escribe el correo para confirmar.
              </p>
              <input
                value={confirmEmail}
                onChange={(event) => setConfirmEmail(event.target.value)}
                placeholder={email}
                aria-label="Correo de la cuenta"
                className={cn(inputClass, "w-full")}
              />
              <button
                disabled={pending || !reasonReady || confirmEmail.trim().toLowerCase() !== email.toLowerCase()}
                onClick={() => run(() => deleteAccount(userId, confirmEmail, reason))}
                className={cn(buttonClass, "mt-auto bg-danger-700 text-surface")}
              >
                Borrar para siempre
              </button>
            </>
          )}
        </section>
        )}
      </div>
    </div>
  );
}
