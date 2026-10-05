"use client";

import { useState, useTransition } from "react";
import { Lock, LockOpen, Trash2 } from "lucide-react";
import { deleteEvent, setEditUnlock, type ActionResult } from "@/app/(admin)/eventos/[id]/super-actions";
import { cn, formatDate } from "@/components/ui";

const inputClass =
  "h-9 rounded-md border border-ink-250 bg-surface px-2.5 outline-none focus:border-gold-600 focus:ring-2 focus:ring-gold-600/30 disabled:opacity-50";
const buttonClass =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-3 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40";

export function EventSuperTools({
  eventId,
  eventName,
  locked,
  activeUnlock,
}: {
  eventId: string;
  eventName: string;
  /** Hoy el cliente no puede editar fecha ni invitación. */
  locked: boolean;
  /** Desbloqueo vigente (null = sin excepción o ya venció). */
  activeUnlock: string | null;
}) {
  const [reason, setReason] = useState("");
  const [days, setDays] = useState(3);
  const [confirmName, setConfirmName] = useState("");
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
          Motivo <span className="font-normal text-ink-600">(obligatorio, queda en Actividad)</span>
        </span>
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={500}
          placeholder="Ej.: cambiaron la sede a última hora"
          className={cn(inputClass, "w-full max-w-xl")}
        />
      </label>
      <p aria-live="polite" className="min-h-5 text-[13px]">
        {pending && <span className="text-ink-600">Aplicando…</span>}
        {!pending && result && <span className={result.ok ? "text-ok-700" : "text-danger-700"}>{result.message}</span>}
      </p>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="flex flex-col gap-2 rounded-xl border border-ink-150 bg-surface p-4 shadow-sm">
          <h3 className="flex items-center gap-1.5 text-[13px] font-semibold">
            {locked ? <Lock size={14} aria-hidden="true" /> : <LockOpen size={14} aria-hidden="true" />}
            Edición del cliente
          </h3>
          <p className="text-xs text-ink-600">
            {activeUnlock
              ? `Desbloqueada hasta ${formatDate(activeUnlock, true)}.`
              : locked
                ? "Bloqueada: faltan menos de 2 semanas para el evento. El cliente no puede cambiar la fecha ni la invitación."
                : "Sin bloqueo por ahora. El bloqueo empieza 2 semanas antes del evento."}
          </p>
          <div className="mt-auto flex flex-wrap gap-2">
            <select value={days} onChange={(event) => setDays(Number(event.target.value))} className={inputClass} aria-label="Duración">
              <option value={1}>1 día</option>
              <option value={3}>3 días</option>
              <option value={7}>7 días</option>
            </select>
            <button
              disabled={pending || !reasonReady}
              onClick={() => run(() => setEditUnlock(eventId, days, reason))}
              className={cn(buttonClass, "bg-ink-950 text-surface hover:bg-ink-800")}
            >
              Desbloquear
            </button>
            {activeUnlock && (
              <button
                disabled={pending || !reasonReady}
                onClick={() => run(() => setEditUnlock(eventId, null, reason))}
                className={cn(buttonClass, "border border-ink-250 hover:bg-paper")}
              >
                Volver a bloquear
              </button>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-2 rounded-xl border border-danger-700/40 bg-danger-100/40 p-4 shadow-sm">
          <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-danger-700">
            <Trash2 size={14} aria-hidden="true" /> Borrar evento
          </h3>
          <p className="text-xs text-ink-600">
            Permanente: invitados, mesas, invitación, álbum y archivos. Las compras quedan registradas sin evento. Escribe el
            nombre exacto para confirmar.
          </p>
          <input
            value={confirmName}
            onChange={(event) => setConfirmName(event.target.value)}
            placeholder={eventName}
            aria-label="Nombre del evento"
            className={cn(inputClass, "w-full")}
          />
          <button
            disabled={pending || !reasonReady || confirmName.trim() !== eventName.trim()}
            onClick={() => run(() => deleteEvent(eventId, confirmName, reason))}
            className={cn(buttonClass, "mt-auto bg-danger-700 text-surface")}
          >
            Borrar para siempre
          </button>
        </section>
      </div>
    </div>
  );
}
