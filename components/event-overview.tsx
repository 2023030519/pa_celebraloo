import "server-only";
import Link from "next/link";
import { getAdminEventDetail } from "@/lib/data/admin";
import { getCatalog } from "@/lib/data/catalog";
import { formatDay, formatMxn } from "@/lib/format";
import { Card, Table, formatDate } from "@/components/ui";
import { DataError, EventStatusBadge, PaymentStatusBadge } from "@/components/finance";
import { NotesPanel } from "@/components/notes-panel";

function Fact({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-ink-600">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-ink-600">{hint}</p>}
    </div>
  );
}

/** Detalle del evento del Panel V1 (sección 8). Sin datos demo. */
export async function EventOverview({ eventId }: { eventId: string }) {
  let detail;
  try {
    detail = await getAdminEventDetail(eventId);
  } catch (error) {
    return (
      <div className="mb-6">
        <DataError error={error} />
      </div>
    );
  }
  if (!detail) return null;
  const catalog = await getCatalog();
  const plan = detail.plan_key ? catalog.plans.find((item) => item.key === detail.plan_key)?.name ?? detail.plan_key : "—";

  return (
    <div className="mb-8 flex flex-col gap-4">
      <Card
        title={
          <span className="flex flex-wrap items-center gap-2">
            Resumen del evento <EventStatusBadge status={detail.status} />
          </span>
        }
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Fact label="Fecha" value={formatDay(detail.event_date)} />
          <Fact label="Plan" value={plan} />
          <Fact
            label="Cliente"
            value={
              detail.owner_id ? (
                <Link href={`/clientes/${detail.owner_id}`} className="text-base hover:underline">
                  {detail.owner_name ?? detail.owner_email ?? "—"}
                </Link>
              ) : (
                "—"
              )
            }
          />
          <Fact label="Invitados" value={detail.guests} />
          <Fact
            label="Confirmados / pend. / rechazados"
            value={`${detail.rsvp_confirmed} / ${detail.rsvp_pending} / ${detail.rsvp_declined}`}
          />
          <Fact label="Invitaciones enviadas" value="No disponible" hint="Hoy no se registra el envío." />
          <Fact label="QR generados" value={detail.qr_generated} />
          <Fact label="Check-ins" value={detail.checked_in} />
          <Fact label="Fotos subidas" value={detail.photos} hint="Álbum, visibles" />
          <Fact label="Invitación" value={detail.published ? "Publicada" : detail.invitation_status ? "Sin publicar" : "Sin iniciar"} />
          <Fact label="Creado" value={<span className="text-sm">{formatDate(detail.created_at, true)}</span>} />
          <Fact label="Última modificación" value={<span className="text-sm">{formatDate(detail.updated_at, true)}</span>} />
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-[13px] font-semibold">Ventas del evento</h2>
          <Table head={["Fecha", "Producto", "Total", "Estado"]} empty={detail.purchases.length === 0 ? "Sin ventas." : undefined}>
            {detail.purchases.map((purchase) => (
              <tr key={purchase.id} className="hover:bg-paper">
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <Link href={`/ventas/${purchase.id}`} className="hover:underline">
                    {formatDate(purchase.sale_at, true)}
                  </Link>
                </td>
                <td className="px-3 py-2.5">{purchase.item_name ?? "—"}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatMxn(purchase.total_cents)}</td>
                <td className="px-3 py-2.5">
                  <PaymentStatusBadge status={purchase.display_status} />
                </td>
              </tr>
            ))}
          </Table>
        </div>
        <NotesPanel targetType="event" targetId={detail.id} />
      </div>
    </div>
  );
}
