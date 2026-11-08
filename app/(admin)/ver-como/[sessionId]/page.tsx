import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/require-admin";
import { getViewAs, type PlanOrigin } from "@/lib/data/admin";
import { getCatalog } from "@/lib/data/catalog";
import { endViewAs } from "@/app/(admin)/clientes/actions";
import { formatDay, formatInt, formatMxn } from "@/lib/format";
import { Badge, Card, Nil, PageTitle, Table, cn, formatDate, ui, zeroClass } from "@/components/ui";
import { EventStatusBadge, PaymentStatusBadge } from "@/components/finance";
import { ViewAsBanner } from "@/components/view-as-banner";

export const metadata: Metadata = { title: "Ver como usuario" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ORIGIN: Record<PlanOrigin, string> = { compra: "comprado", asignado: "asignado", cortesia: "cortesía", prueba: "prueba gratis" };
const ROLE: Record<string, string> = { owner: "Dueño", admin: "Admin", member: "Miembro", planner: "Planner", hostess: "Hostess", viewer: "Solo lectura" };

/**
 * "Ver como usuario": réplica de solo lectura de lo que el cliente ve en su
 * cuenta. No inicia sesión como el cliente ni tiene acciones: los datos salen
 * de admin_view_as, que valida la sesión (15 min, solo de quien la abrió).
 */
export default async function ViewAsPage({ params }: { params: Promise<{ sessionId: string }> }) {
  await requirePermission("clientes.ver_como");
  const { sessionId } = await params;
  if (!UUID.test(sessionId)) notFound();

  const view = await getViewAs(sessionId);
  if (!view || !view.customer) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-ink-150 bg-surface px-6 py-10 text-center">
        <h1 className="text-base font-semibold text-ink-950">La vista ya no está disponible</h1>
        <p className="mt-1.5 text-sm text-ink-600">Las vistas como usuario duran 15 minutos. Ábrela de nuevo desde la ficha del cliente.</p>
        <Link href="/clientes" className={`${ui.buttonSecondary} mt-5`}>
          Ir a Clientes
        </Link>
      </div>
    );
  }

  const catalog = await getCatalog();
  const planName = (key: string) => catalog.plans.find((plan) => plan.key === key)?.name ?? key;
  const exit = endViewAs.bind(null, sessionId, view.customer.id);

  return (
    <>
      <ViewAsBanner who={view.customer.name ?? view.customer.email} expiresAt={view.session.expires_at} exitAction={exit} />

      <PageTitle
        title="Mis eventos"
        subtitle={
          <span className="[overflow-wrap:anywhere]">
            {view.customer.email} · registrado {formatDate(view.customer.registered_at)}
            {!view.customer.email_confirmed && " · correo sin confirmar"}
          </span>
        }
      />

      {view.events.length === 0 ? (
        <p className="mb-6 rounded-lg border border-dashed border-ink-250 px-4 py-6 text-center text-sm text-ink-600">
          Este cliente aún no tiene eventos: vería la pantalla para crear el primero.
        </p>
      ) : (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          {view.events.map((event) => (
            <Card
              key={event.id}
              title={
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span>{event.name}</span>
                  <EventStatusBadge status={event.status} />
                </span>
              }
            >
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs text-ink-600">Fecha</dt>
                  <dd className="font-medium text-ink-950">{formatDay(event.event_date)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-600">Su rol</dt>
                  <dd className="font-medium text-ink-950">{ROLE[event.role] ?? event.role}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-600">Plan</dt>
                  <dd className="font-medium text-ink-950">
                    {event.plan_key ? planName(event.plan_key) : <Nil label="Sin plan" />}
                    {event.plan_origin && <span className="ml-1 text-xs font-normal text-ink-600">({ORIGIN[event.plan_origin]})</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-600">Invitación</dt>
                  <dd>{event.published ? <Badge tone="ok">Publicada</Badge> : <span className="text-ink-600">Sin publicar</span>}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-600">Invitados</dt>
                  <dd className={cn("font-medium tabular-nums", zeroClass(event.guests, "text-ink-950"))}>{formatInt(event.guests)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-600">RSVP</dt>
                  <dd className="tabular-nums">
                    {formatInt(event.rsvp_confirmed)} sí · {formatInt(event.rsvp_pending)} pendientes · {formatInt(event.rsvp_declined)} no
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-600">Check-in</dt>
                  <dd className={cn("tabular-nums", zeroClass(event.checked_in))}>{formatInt(event.checked_in)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-600">Fotos del álbum</dt>
                  <dd className={cn("tabular-nums", zeroClass(event.photos))}>{formatInt(event.photos)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-ink-600">Complementos</dt>
                  <dd>{event.addons.length ? event.addons.map((addon) => addon.name).join(", ") : <Nil label="Ningún complemento" />}</dd>
                </div>
              </dl>
            </Card>
          ))}
        </div>
      )}

      <Table
        title="Mis compras"
        head={[
          "Fecha",
          "Producto",
          <span key="total" className="block text-right">
            Total
          </span>,
          "Estado",
        ]}
        mobileHide={[0]}
        mobileCards
        empty={view.purchases.length === 0 ? "Sin compras." : undefined}
      >
        {view.purchases.map((purchase) => (
          <tr key={purchase.id}>
            <td className="px-3 py-2.5 whitespace-nowrap text-ink-800">{formatDate(purchase.at, true)}</td>
            <td className="px-3 py-2.5">
              {purchase.item_name ?? <Nil />}
              {/* En móvil la columna Fecha se oculta: la fecha baja como segunda línea (R9). */}
              <span className="block text-xs text-ink-600 sm:hidden">{formatDate(purchase.at, true)}</span>
            </td>
            <td className={cn("px-3 py-2.5 text-right tabular-nums", zeroClass(purchase.total_cents))}>{formatMxn(purchase.total_cents)}</td>
            <td className="px-3 py-2.5">
              <PaymentStatusBadge status={purchase.display_status} />
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
