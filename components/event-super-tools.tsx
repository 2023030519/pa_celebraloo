"use client";

import { useId, useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteEvent, setEditUnlock } from "@/app/(admin)/eventos/[id]/super-actions";
import { Select, cn, formatDate, ui } from "@/components/ui";
import { ReasonField, useReasonedAction } from "@/components/permissions-editor";
import type { EditLock } from "@/lib/edit-lock";

/** Candado de edición del cliente (eventos.desbloquear). Va en la columna lateral; su estado ya está en la franja de cifras. */
export function EditLockPanel({
  eventId,
  lock,
  activeUnlock,
}: {
  eventId: string;
  /** Candado según la BD (o el error si no se pudo leer). */
  lock: EditLock;
  /** Desbloqueo vigente (null = sin excepción o ya venció). */
  activeUnlock: string | null;
}) {
  const action = useReasonedAction();
  const [days, setDays] = useState(3);
  const daysId = useId();

  return (
    <section aria-labelledby="candado" className="rounded-lg border border-ink-150 bg-surface">
      <h2 id="candado" className="border-b border-ink-150 px-4 py-3 text-base font-semibold text-ink-950">
        Edición del cliente
      </h2>
      <div className="flex flex-col gap-3 p-4">
        {/* formatDate ya termina en "a.m."/"p.m.": por eso la fecha va al final y sin punto. */}
        <p className="text-[13px] text-ink-800">
          {activeUnlock
            ? `Desbloqueada hasta ${formatDate(activeUnlock, true)}`
            : lock.error !== null
              ? lock.error
              : lock.locked
                ? `El cliente no puede cambiar la fecha ni la invitación. Bloqueada desde ${formatDate(lock.lockAt, true)}`
                : lock.lockAt
                  ? `Sin bloqueo por ahora. Se bloquea 15 días antes del evento (o 72 h después de publicar, lo que pase después): ${formatDate(lock.lockAt, true)}`
                  : "Sin bloqueo: el evento no tiene fecha."}
        </p>
        <ReasonField state={action} placeholder="Ej.: cambiaron la sede a última hora" />
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={daysId} className="text-[13px] font-medium text-ink-800">
              Duración
            </label>
            <Select id={daysId} value={days} onChange={(event) => setDays(Number(event.target.value))} className="w-32">
              <option value={1}>1 día</option>
              <option value={3}>3 días</option>
              <option value={7}>7 días</option>
            </Select>
          </div>
          <button
            type="button"
            disabled={action.pending}
            onClick={() => action.run(() => setEditUnlock(eventId, days, action.reason))}
            className={cn(ui.buttonPrimary, "max-md:w-full")}
          >
            Desbloquear
          </button>
          {activeUnlock && (
            <button
              type="button"
              disabled={action.pending}
              onClick={() => action.run(() => setEditUnlock(eventId, null, action.reason))}
              className={cn(ui.buttonSecondary, "max-md:w-full")}
            >
              Volver a bloquear
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/** Borrado permanente (eventos.borrar): motivo y nombre exacto del evento. */
export function DeleteEventPanel({ eventId, eventName }: { eventId: string; eventName: string }) {
  const action = useReasonedAction();
  const [confirmName, setConfirmName] = useState("");
  const nameId = useId();
  const nameMatches = confirmName.trim() === eventName.trim();

  return (
    <section aria-labelledby="borrar" className="rounded-lg border border-danger-300 bg-surface">
      <div className="border-b border-danger-300 px-4 py-3">
        <h2 id="borrar" className="flex items-center gap-1.5 text-base font-semibold text-danger-700">
          <Trash2 size={14} aria-hidden="true" /> Borrar evento
        </h2>
        <p className="mt-0.5 max-w-[75ch] text-xs text-ink-600">
          Permanente: invitados, mesas, invitación, álbum y archivos. Las compras quedan registradas sin evento.
        </p>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-2">
        <ReasonField state={action} placeholder="Ej.: el cliente pidió borrar su evento" />
        <div className="flex flex-col gap-1">
          <label htmlFor={nameId} className="text-[13px] font-medium text-ink-800">
            Escribe el nombre exacto del evento
          </label>
          <input
            id={nameId}
            value={confirmName}
            onChange={(event) => setConfirmName(event.target.value)}
            placeholder={eventName}
            autoComplete="off"
            className={cn(ui.field, "w-full max-md:h-11")}
          />
          <p className="text-xs text-ink-600">El botón se habilita cuando el nombre coincide.</p>
        </div>
        <div className="md:col-span-2">
          <button
            type="button"
            disabled={action.pending || !nameMatches}
            onClick={() => action.run(() => deleteEvent(eventId, confirmName, action.reason))}
            className={cn(ui.buttonDanger, "max-md:w-full")}
          >
            Borrar para siempre
          </button>
        </div>
      </div>
    </section>
  );
}
