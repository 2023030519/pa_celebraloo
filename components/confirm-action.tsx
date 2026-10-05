"use client";

import { useId, useState, useTransition, type ReactNode } from "react";
import { cn } from "@/components/ui";

export type ConfirmResult = { ok: boolean; message: string };

const TONES = {
  neutral: "border border-ink-250 bg-surface text-ink-800 hover:bg-paper",
  primary: "bg-ink-950 text-surface hover:bg-ink-800",
  danger: "bg-danger-700 text-surface hover:opacity-90",
  ok: "bg-ok-700 text-surface hover:opacity-90",
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
  onConfirm: (reason: string) => Promise<ConfirmResult | void>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<ConfirmResult | null>(null);
  const [pending, startTransition] = useTransition();
  const inputId = useId();
  const button = cn(
    "inline-flex items-center justify-center gap-1.5 rounded-md font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
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
        <div className="flex w-full max-w-md flex-col gap-2 rounded-lg border border-ink-150 bg-paper p-3">
          {description && <div className="text-xs text-ink-800">{description}</div>}
          <label htmlFor={inputId} className="text-xs font-semibold text-ink-800">
            Motivo
          </label>
          <textarea
            id={inputId}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            rows={2}
            placeholder={placeholder}
            className="w-full rounded-md border border-ink-250 bg-surface px-2.5 py-1.5 outline-none focus:border-gold-600 focus:ring-2 focus:ring-gold-600/30"
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
              {pending ? "Aplicando…" : confirmLabel}
            </button>
            <button type="button" disabled={pending} onClick={() => setOpen(false)} className={cn(button, "text-ink-600 hover:bg-surface")}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {result && (
        <p role="status" className={cn("text-xs", result.ok ? "text-ok-700" : "text-danger-700")}>
          {result.message}
        </p>
      )}
    </div>
  );
}
