import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { can, requirePermission } from "@/lib/auth/require-admin";
import { getCustomerCard, type CustomerActivity, type PlanOrigin } from "@/lib/data/admin";
import { getCatalog } from "@/lib/data/catalog";
import { CalendarHeart, CreditCard, Shield, UserPlus, type LucideIcon } from "lucide-react";
import { ADMIN_ACTION_LABELS, TIME_ZONE, formatDay, formatInt, formatMxn } from "@/lib/format";
import { Badge, Breadcrumb, Card, Email, Nil, PageTitle, SectionNav, Table, cn, formatDate, ui, zeroClass } from "@/components/ui";
import { Figure, FigureRow, FigureStrip } from "@/components/kpi";
import { DataError, EventStatusBadge, PaymentStatusBadge } from "@/components/finance";
import { NotesPanel } from "@/components/notes-panel";
import { CustomerActions } from "@/components/customer-actions";

export const metadata: Metadata = { title: "Cliente" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// El origen es una categoría, no un estado que pida atención: va en tono neutral (R4).
const ORIGIN: Record<PlanOrigin, string> = {
  compra: "Comprado",
  asignado: "Asignado",
  cortesia: "Cortesía",
  prueba: "Prueba gratis",
};

// Tipo como texto gris con ícono, sin píldora (R13): el color queda para lo que pide atención.
const ACTIVITY_KIND: Record<CustomerActivity["kind"], { label: string; icon: LucideIcon }> = {
  registro: { label: "Registro", icon: UserPlus },
  evento: { label: "Evento", icon: CalendarHeart },
  pago: { label: "Pago", icon: CreditCard },
  admin: { label: "Panel", icon: Shield },
};

const timeFormat = new Intl.DateTimeFormat("es-MX", { timeStyle: "short", timeZone: TIME_ZONE });
const timeOf = (at: string) => timeFormat.format(new Date(at));

/** Agrupa la actividad (ya ordenada) por día de Ciudad de México, conservando el orden. */
function byDay(items: CustomerActivity[]): [string, CustomerActivity[]][] {
  const groups: [string, CustomerActivity[]][] = [];
  for (const item of items) {
    const day = formatDate(item.at);
    const last = groups[groups.length - 1];
    if (last?.[0] === day) last[1].push(item);
    else groups.push([day, [item]]);
  }
  return groups;
}

const recordLink = "font-medium text-ink-950 underline-offset-[3px] hover:underline";
// Móvil (M2): el enlace se estira sobre toda la tarjeta; en escritorio la fila no cambia.
const rowLink = `${recordLink} max-sm:after:absolute max-sm:after:inset-0`;

function Num({ children }: { children: ReactNode }) {
  return <span className="block text-right">{children}</span>;
}

function Count({ n, one, many }: { n: number; one: string; many: string }) {
  return (
    <span className="text-[13px] text-ink-600 tabular-nums">
      {formatInt(n)} {n === 1 ? one : many}
    </span>
  );
}

// stacked: etiqueta arriba y valor abajo, para correos que no caben junto a la etiqueta (R10).
function Row({ label, stacked, children }: { label: string; stacked?: boolean; children: ReactNode }) {
  return (
    <div className={stacked ? "flex flex-col gap-0.5 px-4 py-2.5" : "grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 px-4 py-2.5"}>
      <dt className="text-[13px] text-ink-600">{label}</dt>
      <dd className="text-[13px] break-words text-ink-950">{children}</dd>
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
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  // Las tres a la vez, no en fila: la RPC vuelve a validar el permiso en la BD y, si
  // requirePermission falla, la página no muestra nada de lo que se leyó.
  const [admin, result, catalog] = await Promise.all([
    requirePermission("clientes.read"),
    getCustomerCard(id).then(
      (card) => ({ card }),
      (error: unknown) => ({ error })
    ),
    getCatalog(),
  ]);
  if ("error" in result) return <DataError error={result.error} />;
  const { card } = result;
  if (!card) notFound();
  const planName = (key: string) => catalog.plans.find((plan) => plan.key === key)?.name ?? key;
  const actionsCan = {
    resend: can(admin, "clientes.reenviar_confirmacion"),
    assign: can(admin, "eventos.asignar_plan"),
    courtesy: can(admin, "eventos.cortesia"),
    suspend: can(admin, "clientes.suspender"),
    viewAs: can(admin, "clientes.ver_como"),
  };
  // M4: chips en el orden en que las secciones se ven en móvil (notas y acciones cierran la página).
  const sections = [
    { id: "datos", label: "Datos" },
    { id: "eventos", label: "Eventos" },
    { id: "compras", label: "Compras" },
    { id: "actividad", label: "Actividad" },
    { id: "notas", label: "Notas" },
    ...(Object.values(actionsCan).some(Boolean) ? [{ id: "acciones", label: "Acciones" }] : []),
  ];

  return (
    <>
      <Breadcrumb items={[{ href: "/clientes", label: "Clientes" }]} />
      <PageTitle
        title={card.name ?? <Email value={card.email} />}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Email value={card.email} className="grow basis-60" />
            {/* Solo excepciones (R13): "Activa" y "sin compras" no llevan chip; Staff no es un estado y va como texto (R22). */}
            {card.disabled && <Badge tone="danger">Suspendida</Badge>}
            {card.is_paying && <Badge>De pago</Badge>}
            {!card.email_confirmed && <Badge tone="warn">Correo sin confirmar</Badge>}
            {card.is_staff && <span className="text-xs">Staff (no cuenta en métricas)</span>}
          </span>
        }
        actions={
          (can(admin, "roles.write") || can(admin, "clientes.suspender")) && (
            <Link href={`/usuarios/${card.id}`} className={ui.buttonSecondary}>
              Cuenta y acceso
            </Link>
          )
        }
      />
      <SectionNav items={sections} />

      {/* Escritorio: principal a la izquierda (tablas, actividad y acciones) y lateral de 320 px
          (resumen, datos y notas), como la ficha de evento. Móvil: el lateral se disuelve en la rejilla
          (contents) y las notas bajan después de eventos y compras; las acciones de cuenta, con
          Suspender, cierran la página (R18). Los div con id son las anclas de SectionNav (M4). */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <aside aria-label="Resumen del cliente" className="flex min-w-0 flex-col gap-6 max-lg:contents lg:col-start-2 lg:row-start-1">
          <h2 className="sr-only">Resumen</h2>
          <FigureStrip>
            <Figure label="Total gastado" value={formatMxn(card.spent_cents)} />
            <FigureRow cols={2} label="Eventos y compras">
              <Figure size="md" label="Eventos" value={formatInt(card.events)} />
              <Figure size="md" label="Compras" value={formatInt(card.paid_purchases)} />
            </FigureRow>
          </FigureStrip>

          <section id="datos" aria-labelledby="customer-data" className="rounded-lg border border-ink-150 bg-surface">
            <h2 id="customer-data" className="border-b border-ink-150 px-4 py-3 text-base font-semibold text-ink-950">
              Datos generales
            </h2>
            <dl className="divide-y divide-ink-150">
              <Row label="Nombre">{card.name ?? <Nil />}</Row>
              <Row label="Correo" stacked>
                <Email value={card.email} />
              </Row>
              <Row label="Teléfono">{card.phone || <Nil />}</Row>
              <Row label="Registro">{formatDate(card.registered_at, true)}</Row>
              <Row label="Último acceso">{card.last_sign_in_at ? formatDate(card.last_sign_in_at, true) : <Nil />}</Row>
              <Row label="Última compra">{card.last_paid_at ? formatDate(card.last_paid_at, true) : <Nil label="Sin compras" />}</Row>
              <Row label="Última actividad">
                {card.last_activity_at ? formatDate(card.last_activity_at, true) : <Nil label="Sin actividad registrada" />}
              </Row>
              <Row label="Fuente de adquisición">
                {card.acq_channel && card.acq_channel !== "Sin dato" ? card.acq_channel : <Nil />}
                {card.acq_utm_campaign && <span className="block text-xs text-ink-600">Campaña: {card.acq_utm_campaign}</span>}
              </Row>
            </dl>
          </section>

          <div id="notas" className="min-w-0 max-lg:order-last">
            <NotesPanel targetType="customer" targetId={card.id} />
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-6 max-lg:contents lg:col-start-1 lg:row-start-1">
          <div id="eventos" className="min-w-0">
            <Table
              title="Eventos"
              aside={<Count n={card.events_list.length} one="evento" many="eventos" />}
              head={["Evento", "Fecha", "Plan", "Complementos", "Invitación", "Estado"]}
              mobileHide={[1, 2, 3]}
              mobileCards
              empty={card.events_list.length === 0 ? "La cuenta no es dueña de ningún evento." : undefined}
            >
              {card.events_list.map((event) => (
                <tr key={event.id} className="align-top max-sm:relative">
                  <td className="px-3 py-2.5">
                    <Link href={`/eventos/${event.id}`} className={rowLink}>
                      {event.name}
                    </Link>
                    {/* En móvil la columna Fecha se oculta: la fecha baja como segunda línea (R9). */}
                    <p className="text-xs text-ink-600 sm:hidden">{formatDay(event.event_date)}</p>
                    <p className="text-xs text-ink-600 tabular-nums">{formatInt(event.guests)} invitados</p>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-ink-800">{formatDay(event.event_date)}</td>
                  <td className="px-3 py-2.5">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {event.plan_key ? planName(event.plan_key) : <Nil label="Sin plan" />}
                      {event.plan_origin && <Badge>{ORIGIN[event.plan_origin]}</Badge>}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {event.addons.length === 0 ? (
                      <Nil label="Ningún complemento" />
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {event.addons.map((addon) => (
                          <li key={addon.key} className="flex flex-wrap items-center gap-1.5">
                            {addon.name}
                            <Badge>{ORIGIN[addon.origin]}</Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-3 py-2.5">{event.published ? <Badge tone="ok">Publicada</Badge> : <span className="text-ink-600">Sin publicar</span>}</td>
                  <td className="px-3 py-2.5">
                    <EventStatusBadge status={event.status} />
                  </td>
                </tr>
              ))}
            </Table>
          </div>

          <div id="compras" className="min-w-0">
            <Table
              title="Compras"
              aside={<Count n={card.purchases.length} one="compra" many="compras" />}
              head={["Fecha", "Producto", <Num key="total">Total</Num>, <Num key="refund">Reembolsado</Num>, "Estado"]}
              // Móvil (M2): fecha y producto a la izquierda; total y estado a la derecha.
              mobileHide={[1, 3]}
              mobileCards
              empty={card.purchases.length === 0 ? "Aún no ha comprado." : undefined}
            >
              {card.purchases.map((purchase) => (
                <tr key={purchase.id} className="max-sm:relative">
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <Link href={`/ventas/${purchase.id}`} className={rowLink}>
                      {formatDate(purchase.sale_at, true)}
                    </Link>
                    {/* En móvil la columna Producto se oculta: baja como segunda línea (R9). */}
                    <span className="block truncate text-xs text-ink-600 sm:hidden">
                      {purchase.item_name ?? <Nil />}
                      {purchase.item_type === "addon" && " (complemento)"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {purchase.item_name ?? <Nil />}
                    {purchase.item_type === "addon" && <span className="ml-1 text-xs text-ink-600">(complemento)</span>}
                  </td>
                  <td className={cn("px-3 py-2.5 text-right tabular-nums", zeroClass(purchase.total_cents))}>{formatMxn(purchase.total_cents)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {purchase.refunded_cents ? formatMxn(purchase.refunded_cents) : <Nil label="Sin reembolso" />}
                  </td>
                  <td className="px-3 py-2.5">
                    <PaymentStatusBadge status={purchase.display_status} />
                  </td>
                </tr>
              ))}
            </Table>
          </div>

          <div id="actividad" className="min-w-0">
            <Card title="Actividad">
              {card.activity.length === 0 ? (
                <p className="text-sm text-ink-600">Sin actividad registrada.</p>
              ) : (
                // Agrupada por día (R12): encabezado con la fecha y en cada fila solo la hora.
                <div className="-my-2 flex flex-col">
                  {byDay(card.activity).map(([day, items]) => (
                    <section key={day} aria-label={day}>
                      <h3 className="border-b border-ink-150 pt-3 pb-1.5 text-xs font-medium text-ink-600">{day}</h3>
                      <ol className="flex flex-col divide-y divide-ink-150">
                        {items.map((item, index) => {
                          const href = activityHref(item);
                          const title = item.kind === "admin" ? ADMIN_ACTION_LABELS[item.title] ?? item.title : item.title;
                          const { label, icon: Icon } = ACTIVITY_KIND[item.kind];
                          const actor = item.actor ?? (item.kind === "registro" ? "El cliente" : null);
                          return (
                            <li key={`${item.at}-${index}`} className="flex items-start gap-3 py-2.5">
                              <span className="w-24 shrink-0 pt-px">
                                <span className="inline-flex items-center gap-1 text-xs text-ink-600">
                                  <Icon size={12} aria-hidden="true" />
                                  {label}
                                </span>
                              </span>
                              <span className="min-w-0 flex-1 text-sm">
                                <span className="block font-medium text-ink-950">
                                  {href ? (
                                    <Link href={href} className={recordLink}>
                                      {title}
                                    </Link>
                                  ) : (
                                    title
                                  )}
                                </span>
                                {item.detail && (
                                  <span title={item.detail} className="block truncate text-xs text-ink-600">
                                    {item.detail}
                                  </span>
                                )}
                                <span className="block text-xs text-ink-600 tabular-nums">
                                  {timeOf(item.at)}
                                  {actor && ` · ${actor}`}
                                </span>
                              </span>
                            </li>
                          );
                        })}
                      </ol>
                    </section>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <CustomerActions
            id="acciones"
            className="max-lg:order-last"
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
            can={actionsCan}
          />
        </div>
      </div>
    </>
  );
}
