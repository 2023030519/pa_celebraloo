import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requirePermission } from "@/lib/auth/require-admin";
import { getCustomerCard, type CustomerActivity, type PlanOrigin } from "@/lib/data/admin";
import { getCatalog } from "@/lib/data/catalog";
import { ADMIN_ACTION_LABELS, formatDay, formatInt, formatMxn } from "@/lib/format";
import { Badge, Card, PageTitle, Table, formatDate, type Tone } from "@/components/ui";
import { DataError, EventStatusBadge, PaymentStatusBadge } from "@/components/finance";
import { NotesPanel } from "@/components/notes-panel";
import { CustomerActions } from "@/components/customer-actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ORIGIN: Record<PlanOrigin, { label: string; tone: Tone }> = {
  compra: { label: "Comprado", tone: "ok" },
  asignado: { label: "Asignado", tone: "info" },
  cortesia: { label: "Cortesía", tone: "gold" },
  prueba: { label: "Prueba", tone: "neutral" },
};

const ACTIVITY_KIND: Record<CustomerActivity["kind"], string> = {
  registro: "Registro",
  evento: "Evento",
  pago: "Pago",
  admin: "Panel",
};

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-ink-600">{label}</p>
      <p className="mt-0.5 font-medium break-all">{children}</p>
    </div>
  );
}

function activityHref(item: CustomerActivity): string | null {
  if (!item.target_id) return null;
  if (item.target_type === "purchase") return `/ventas/${item.target_id}`;
  if (item.target_type === "event") return `/eventos/${item.target_id}`;
  return null;
}

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePermission("clientes.read");
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  let card;
  try {
    card = await getCustomerCard(id);
  } catch (error) {
    return <DataError error={error} />;
  }
  if (!card) notFound();

  const catalog = await getCatalog();
  const planName = (key: string | null) => (key ? catalog.plans.find((plan) => plan.key === key)?.name ?? key : "Sin plan");

  return (
    <>
      <PageTitle
        title={card.name ?? card.email}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {card.email}
            {card.disabled ? <Badge tone="danger">Suspendida</Badge> : <Badge tone="ok">Activa</Badge>}
            {card.is_paying ? <Badge tone="ok">De pago</Badge> : <Badge>Gratuito</Badge>}
            {!card.email_confirmed && <Badge tone="warn">Correo sin confirmar</Badge>}
            {card.is_staff && <Badge tone="info">Staff (no cuenta en métricas)</Badge>}
          </span>
        }
        actions={
          (can(admin, "roles.write") || can(admin, "clientes.suspender")) && (
            <Link
              href={`/usuarios/${card.id}`}
              className="inline-flex h-9 items-center rounded-md border border-ink-250 bg-surface px-3 font-semibold text-ink-800 hover:bg-paper"
            >
              Cuenta y acceso
            </Link>
          )
        }
      />

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card title="Datos generales">
          <div className="grid grid-cols-2 gap-4">
            <Fact label="Nombre">{card.name ?? "—"}</Fact>
            <Fact label="Email">{card.email}</Fact>
            <Fact label="Teléfono">{card.phone || "—"}</Fact>
            <Fact label="Fecha de registro">{formatDate(card.registered_at, true)}</Fact>
            <Fact label="Último acceso">{formatDate(card.last_sign_in_at, true)}</Fact>
            <Fact label="Fuente de adquisición">
              {card.acq_channel}
              {card.acq_utm_campaign && <span className="block text-xs font-normal text-ink-600">Campaña: {card.acq_utm_campaign}</span>}
            </Fact>
          </div>
        </Card>
        <Card title="Resumen">
          <div className="grid grid-cols-2 gap-4">
            <Fact label="Eventos">{formatInt(card.events)}</Fact>
            <Fact label="Total gastado">{formatMxn(card.spent_cents)}</Fact>
            <Fact label="Compras realizadas">{formatInt(card.paid_purchases)}</Fact>
            <Fact label="Última compra">{card.last_paid_at ? formatDate(card.last_paid_at, true) : "Sin compras"}</Fact>
            <Fact label="Última actividad">
              {card.last_activity_at ? formatDate(card.last_activity_at, true) : "Sin actividad registrada"}
            </Fact>
          </div>
        </Card>
      </div>

      <div className="mb-6">
        <CustomerActions
          customer={{
            id: card.id,
            email: card.email,
            emailConfirmed: card.email_confirmed,
            disabled: card.disabled,
            isStaff: card.is_staff,
            isSelf: card.id === admin.userId,
          }}
          events={card.events_list.map((event) => ({ key: event.id, name: event.name }))}
          plans={catalog.plans.filter((plan) => plan.key !== "tour").map((plan) => ({ key: plan.key, name: plan.name }))}
          addons={catalog.addons.filter((addon) => addon.isActive).map((addon) => ({ key: addon.key, name: addon.name }))}
          can={{
            resend: can(admin, "clientes.reenviar_confirmacion"),
            assign: can(admin, "eventos.asignar_plan"),
            courtesy: can(admin, "eventos.cortesia"),
            suspend: can(admin, "clientes.suspender"),
            viewAs: can(admin, "clientes.ver_como"),
          }}
        />
      </div>

      <h2 className="mb-2 text-[15px] font-semibold">Eventos</h2>
      <div className="mb-6">
        <Table
          head={["Evento", "Fecha", "Plan", "Complementos", "Invitación", "Estado"]}
          empty={card.events_list.length === 0 ? "Aún no ha creado eventos." : undefined}
        >
          {card.events_list.map((event) => (
            <tr key={event.id} className="align-top hover:bg-paper">
              <td className="px-3 py-2.5">
                <Link href={`/eventos/${event.id}`} className="font-medium hover:underline">
                  {event.name}
                </Link>
                <p className="text-xs text-ink-600">{formatInt(event.guests)} invitados</p>
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap">{formatDay(event.event_date)}</td>
              <td className="px-3 py-2.5">
                <span className="flex flex-wrap items-center gap-1.5">
                  {planName(event.plan_key)}
                  {event.plan_origin && <Badge tone={ORIGIN[event.plan_origin].tone}>{ORIGIN[event.plan_origin].label}</Badge>}
                </span>
              </td>
              <td className="px-3 py-2.5">
                {event.addons.length === 0 ? (
                  <span className="text-ink-600">Ninguno</span>
                ) : (
                  <ul className="flex flex-col gap-0.5">
                    {event.addons.map((addon) => (
                      <li key={addon.key} className="flex flex-wrap items-center gap-1.5">
                        {addon.name}
                        <Badge tone={ORIGIN[addon.origin].tone}>{ORIGIN[addon.origin].label}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </td>
              <td className="px-3 py-2.5">{event.published ? <Badge tone="ok">Publicada</Badge> : <Badge>Sin publicar</Badge>}</td>
              <td className="px-3 py-2.5">
                <EventStatusBadge status={event.status} />
              </td>
            </tr>
          ))}
        </Table>
      </div>

      <h2 className="mb-2 text-[15px] font-semibold">Compras</h2>
      <div className="mb-6">
        <Table head={["Fecha", "Producto", "Total", "Reembolsado", "Estado"]} empty={card.purchases.length === 0 ? "Aún no ha comprado." : undefined}>
          {card.purchases.map((purchase) => (
            <tr key={purchase.id} className="hover:bg-paper">
              <td className="px-3 py-2.5 whitespace-nowrap">
                <Link href={`/ventas/${purchase.id}`} className="hover:underline">
                  {formatDate(purchase.sale_at, true)}
                </Link>
              </td>
              <td className="px-3 py-2.5">
                {purchase.item_name ?? "—"}
                {purchase.item_type === "addon" && <span className="ml-1 text-xs text-ink-600">(complemento)</span>}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatMxn(purchase.total_cents)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{purchase.refunded_cents ? formatMxn(purchase.refunded_cents) : "—"}</td>
              <td className="px-3 py-2.5">
                <PaymentStatusBadge status={purchase.display_status} />
              </td>
            </tr>
          ))}
        </Table>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Actividad">
          {card.activity.length === 0 ? (
            <p className="text-ink-600">Sin actividad registrada.</p>
          ) : (
            <ol className="flex flex-col divide-y divide-ink-150">
              {card.activity.map((item, index) => {
                const href = activityHref(item);
                const title = item.kind === "admin" ? ADMIN_ACTION_LABELS[item.title] ?? item.title : item.title;
                return (
                  <li key={`${item.at}-${index}`} className="flex items-start gap-3 py-2">
                    <span className="w-16 shrink-0 pt-0.5">
                      <Badge tone={item.kind === "admin" ? "gold" : item.kind === "pago" ? "ok" : "neutral"}>{ACTIVITY_KIND[item.kind]}</Badge>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">
                        {href ? (
                          <Link href={href} className="hover:underline">
                            {title}
                          </Link>
                        ) : (
                          title
                        )}
                      </span>
                      {item.detail && <span className="block truncate text-xs text-ink-600">{item.detail}</span>}
                      <span className="block text-xs text-ink-600">
                        {formatDate(item.at, true)}
                        {item.actor && ` · ${item.actor}`}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
        <NotesPanel targetType="customer" targetId={card.id} />
      </div>
    </>
  );
}
