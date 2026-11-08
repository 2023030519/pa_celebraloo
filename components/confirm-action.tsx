"use client";

import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { cn, ui } from "@/components/ui";

export type ConfirmResult = { ok: boolean; message: string };

const TONES = {
  neutral: "border border-ink-250 bg-surface text-ink-950 hover:bg-surface-2",
  primary: "bg-gold-800 text-surface hover:bg-gold-900",
  danger: "bg-danger-700 text-surface hover:bg-danger-800",
  ok: "bg-ok-700 text-surface hover:bg-ok-800",
} as const;

/**
 * Acción administrativa con confirmación y motivo obligatorio (mínimo 3
 * caracteres). El motivo viaja a la acción del servidor, que lo vuelve a
 * validar y lo deja en la bitácora.
 */
export function ConfirmAction({
  label,
  confirmLabel = "Confirmar",
  tone = "neutral",
  description,
  placeholder = "Motivo (obligatorio, queda en Actividad)",
  disabledReason,
  size = "md",
  pendingLabel = "Aplicando…",
  onConfirm,
}: {
  label: ReactNode;
  confirmLabel?: string;
  tone?: keyof typeof TONES;
  description?: ReactNode;
  placeholder?: string;
  /** Si hay texto, el botón no se puede usar y se explica por qué. */
  disabledReason?: string | null;
  size?: "sm" | "md";
  /** Texto del botón mientras corre la acción (p. ej. si tarda). */
  pendingLabel?: string;
  onConfirm: (reason: string) => Promise<ConfirmResult | void>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<ConfirmResult | null>(null);
  const [pending, startTransition] = useTransition();
  const inputId = useId();
  // Al cerrar el panel del motivo, el foco vuelve al botón que lo abrió (no a <body>).
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);
  const button = cn(
    "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors duration-[var(--dur-fast)] disabled:border disabled:border-ink-250 disabled:bg-surface-2 disabled:text-ink-400 disabled:cursor-not-allowed",
    size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3"
  );

  if (disabledReason) {
    return (
      <span className="flex flex-col items-start gap-1">
        <button type="button" disabled className={cn(button, TONES.neutral)}>
          {label}
        </button>
        <span className="text-xs text-ink-600">{disabledReason}</span>
      </span>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      {!open ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => {
            setOpen(true);
            setResult(null);
          }}
          className={cn(button, TONES[tone === "primary" ? "primary" : "neutral"])}
        >
          {label}
        </button>
      ) : (
        <div className="animate-enter flex w-full max-w-md flex-col gap-2 rounded-lg border border-ink-150 bg-surface-2/60 p-3">
          {description && <div className="text-xs text-ink-800">{description}</div>}
          <label htmlFor={inputId} className="text-[13px] font-medium text-ink-800">
            Motivo
          </label>
          <textarea
            id={inputId}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            rows={2}
            placeholder={placeholder}
            autoFocus
            className={cn(ui.field, "h-auto w-full py-2")}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || reason.trim().length < 3}
              onClick={() =>
                startTransition(async () => {
                  const outcome = await onConfirm(reason);
                  if (outcome) setResult(outcome);
                  if (!outcome || outcome.ok) {
                    setOpen(false);
                    setReason("");
                  }
                })
              }
              className={cn(button, TONES[tone])}
            >
              {pending ? pendingLabel : confirmLabel}
            </button>
            <button type="button" disabled={pending} onClick={() => setOpen(false)} className={cn(button, "text-ink-600 hover:bg-surface-2 hover:text-ink-950")}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {/* Siempre montado: un live region que aparece ya lleno a menudo no se anuncia. */}
      <p role="status" className={cn("text-xs empty:hidden", result?.ok ? "text-ok-700" : "text-danger-700")}>
        {result?.message}
      </p>
    </div>
  );
}
