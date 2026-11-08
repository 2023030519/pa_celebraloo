import type { ReactNode } from "react";
import { Lock, LockOpen } from "lucide-react";
import type { AdminEventDetail } from "@/lib/data/admin";
import type { EditLock } from "@/lib/edit-lock";
import { formatDay, formatInt } from "@/lib/format";
import { Card, Nil, formatDate } from "@/components/ui";
import { Figure, FigureRow, FigureStrip } from "@/components/kpi";

/** Estado del candado de edición del cliente, como cifra de la franja. */
function editFigure(lock: EditLock, activeUnlock: string | null): { value: ReactNode; hint?: string } {
  const withIcon = (open: boolean, text: string, className?: string) => (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      {open ? <LockOpen size={16} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}
      {text}
    </span>
  );
  if (activeUnlock) return { value: withIcon(true, "Desbloqueada", "text-warn-700"), hint: `Hasta ${formatDate(activeUnlock, true)}` };
  if (lock.error !== null) return { value: <span className="text-danger-700">No se pudo leer</span>, hint: lock.error };
  if (lock.locked) return { value: withIcon(false, "Bloqueada"), hint: lock.lockAt ? `Desde ${formatDate(lock.lockAt, true)}` : undefined };
  return { value: withIcon(true, "Sin bloqueo"), hint: lock.lockAt ? `Se bloquea ${formatDate(lock.lockAt, true)}` : "El evento no tiene fecha" };
}

/** Franja de la ficha (Panel V1, sección 8): el contrato (plan, invitación, edición) y la operación. Sin datos demo. */
export function EventFigures({
  detail,
  planName,
  lock,
  activeUnlock,
}: {
  detail: AdminEventDetail;
  planName: string | null;
  lock: EditLock;
  activeUnlock: string | null;
}) {
  const edit = editFigure(lock, activeUnlock);
  return (
    <FigureStrip>
      <FigureRow cols={3} label="Contrato del evento">
        <Figure size="sm" label="Plan" value={planName && planName !== "—" ? planName : "Sin plan"} />
        <Figure
          size="sm"
          label="Invitación"
          value={detail.published ? "Publicada" : detail.invitation_status ? "Sin publicar" : "Sin iniciar"}
        />
        <Figure size="sm" label="Edición del cliente" value={edit.value} hint={edit.hint} />
      </FigureRow>
      <FigureRow cols={4} label="Operación del evento">
        <Figure
          size="md"
          label="Invitados"
          value={formatInt(detail.guests)}
          hint={`${detail.rsvp_confirmed} confirmados · ${detail.rsvp_pending} pend. · ${detail.rsvp_declined} rechazados`}
        />
        <Figure size="md" label="QR generados" value={formatInt(detail.qr_generated)} />
        <Figure size="md" label="Check-ins" value={formatInt(detail.checked_in)} />
        <Figure size="md" label="Fotos subidas" value={formatInt(detail.photos)} hint="Álbum, visibles" />
      </FigureRow>
    </FigureStrip>
  );
}

function Row({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="text-[13px] text-ink-600">{label}</dt>
      <dd className="text-right text-[13px] font-medium text-ink-950">
        {children}
        {hint && <span className="block text-xs font-normal text-ink-600">{hint}</span>}
      </dd>
    </div>
  );
}

/** Resumen lateral de la ficha: fechas y envíos. Plan, invitación y edición van en la franja; el estado, en el encabezado. */
export function EventSummary({ detail }: { detail: AdminEventDetail }) {
  return (
    <Card title="Resumen">
      <dl className="-my-2 divide-y divide-ink-150">
        <Row label="Fecha">{formatDay(detail.event_date)}</Row>
        <Row label="Invitaciones enviadas" hint="Hoy no se registra el envío.">
          <Nil label="No disponible" />
        </Row>
        <Row label="Creado">{formatDate(detail.created_at, true)}</Row>
        <Row label="Última modificación">{formatDate(detail.updated_at, true)}</Row>
      </dl>
    </Card>
  );
}
