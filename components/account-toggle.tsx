"use client";

import { useState, useTransition } from "react";
import { setAccountDisabled } from "@/app/(admin)/usuarios/actions";
import { cn } from "@/components/ui";

/**
 * Deshabilitar pide un segundo clic (confirmar); habilitar es inmediato
 * porque no le quita nada a nadie.
 */
export function AccountToggle({ userId, disabled, locked }: { userId: string; disabled: boolean; locked?: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (locked) return <span className="text-xs text-ink-600">{locked}</span>;

  const run = (next: boolean) => {
    setError(null);
    startTransition(async () => {
      const result = await setAccountDisabled(userId, next);
      if (!result.ok) setError(result.message);
      setConfirming(false);
    });
  };

  const button =
    "inline-flex h-8 items-center justify-center rounded-md px-2.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <span className="flex flex-col items-start gap-1">
      {disabled ? (
        <button type="button" disabled={pending} onClick={() => run(false)} className={cn(button, "bg-ok-100 text-ok-700 hover:opacity-80")}>
          {pending ? "Habilitando…" : "Habilitar"}
        </button>
      ) : confirming ? (
        <span className="flex gap-1">
          <button type="button" disabled={pending} onClick={() => run(true)} className={cn(button, "bg-danger-700 text-surface")}>
            {pending ? "Deshabilitando…" : "Confirmar"}
          </button>
          <button type="button" disabled={pending} onClick={() => setConfirming(false)} className={cn(button, "text-ink-600 hover:bg-paper")}>
            Cancelar
          </button>
        </span>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className={cn(button, "border border-ink-250 text-ink-800 hover:bg-paper")}>
          Deshabilitar
        </button>
      )}
      {error && <span className="text-xs text-danger-700">{error}</span>}
    </span>
  );
}
