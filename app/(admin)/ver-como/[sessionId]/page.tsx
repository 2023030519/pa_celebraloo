import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/require-admin";
import { getViewAs, type PlanOrigin } from "@/lib/data/admin";
import { getCatalog } from "@/lib/data/catalog";
import { endViewAs } from "@/app/(admin)/clientes/actions";
import { formatDay, formatInt, formatMxn } from "@/lib/format";
import { Badge, Card, Table, formatDate } from "@/components/ui";
import { EventStatusBadge, PaymentStatusBadge } from "@/components/finance";
import { ViewAsBanner } from "@/components/view-as-banner";

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
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-lg font-semibold">La vista ya no está disponible</h1>
        <p className="mt-2 text-ink-600">Las vistas como usuario duran 15 minutos. Ábrela de nuevo desde la ficha del cliente.</p>
        <Link href="/clientes" className="mt-4 inline-block font-semibold text-gold-800 hover:underline">
          Ir a Clientes
        </Link>
      </div>
    );
  }

  const catalog = await getCatalog();
  const planName = (key: string | null) => (key ? catalog.plans.find((plan) => plan.key === key)?.name ?? key : "Sin plan");
  const exit = endViewAs.bind(null, sessionId, view.customer.id);

  return (
    <>
      <ViewAsBanner who={view.customer.name ?? view.customer.email} expiresAt={view.session.expires_at} exitAction={exit} />

      <div className="mb-5">
        <h1 className="text-xl font-semibold text-ink-950">Mis eventos</h1>
        <p className="mt-1 text-ink-600">
          {view.customer.email} · registrado {formatDate(view.customer.registered_at)}
          {!view.customer.email_confirmed && " · correo sin confirmar"}
        </p>
      </div>

      {view.events.length === 0 ? (
        <Card>
          <p className="text-ink-600">Este cliente aún no tiene eventos: vería la pantalla para crear el primero.</p>
        </Card>
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
                  <dd className="font-medium">{formatDay(event.event_date)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-600">Su rol</dt>
                  <dd className="font-medium">{ROLE[event.role] ?? event.role}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-600">Plan</dt>
                  <dd className="font-medium">
                    {planName(event.plan_key)}
                    {event.plan_origin && <span className="ml-1 text-xs font-normal text-ink-600">({ORIGIN[event.plan_origin]})</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-600">Invitación</dt>
                  <dd>{event.published ? <Badge tone="ok">Publicada</Badge> : <Badge>Sin publicar</Badge>}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-600">Invitados</dt>
                  <dd className="font-medium tabular-nums">{formatInt(event.guests)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-600">RSVP</dt>
                  <dd className="tabular-nums">
                    {formatInt(event.rsvp_confirmed)} sí · {formatInt(event.rsvp_pending)} pendientes · {formatInt(event.rsvp_declined)} no
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-600">Check-in</dt>
                  <dd className="tabular-nums">{formatInt(event.checked_in)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-600">Fotos del álbum</dt>
                  <dd className="tabular-nums">{formatInt(event.photos)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-ink-600">Complementos</dt>
                  <dd>{event.addons.length ? event.addons.map((addon) => addon.name).join(", ") : "Ninguno"}</dd>
                </div>
              </dl>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-2 text-[15px] font-semibold">Mis compras</h2>
      <Table head={["Fecha", "Producto", "Total", "Estado"]} empty={view.purchases.length === 0 ? "Sin compras." : undefined}>
        {view.purchases.map((purchase) => (
          <tr key={purchase.id}>
            <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(purchase.at, true)}</td>
            <td className="px-3 py-2.5">{purchase.item_name ?? "—"}</td>
            <td className="px-3 py-2.5 text-right tabular-nums">{formatMxn(purchase.total_cents)}</td>
            <td className="px-3 py-2.5">
              <PaymentStatusBadge status={purchase.display_status} />
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
