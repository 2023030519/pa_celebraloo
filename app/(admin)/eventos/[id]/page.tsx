import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Eye } from "lucide-react";
import { can, requirePermission } from "@/lib/auth/require-admin";
import { getEventDetail, type EventDetail } from "@/lib/data/events";
import { getAdminEventDetail, type AdminEventDetail } from "@/lib/data/admin";
import { formatMxn, formatValue, getCatalog, type CapabilityValue } from "@/lib/data/catalog";
import { Badge, Card, Email, Nil, PageTitle, SectionNav, Table, formatDate, ui } from "@/components/ui";
import {
  PermissionsEditor,
  type EditorCapability,
  type EditorOption,
  type EditorOrigin,
} from "@/components/permissions-editor";
import { DeleteEventPanel, EditLockPanel } from "@/components/event-super-tools";
import { EventFigures, EventSummary } from "@/components/event-overview";
import { NotesPanel } from "@/components/notes-panel";
import { DataError, EventStatusBadge, PaymentStatusBadge } from "@/components/finance";
import { activeUnlock, getEditLock } from "@/lib/edit-lock";
import { EVENT_TYPE, MEMBER_ROLE, NO_OWNER, TIME_ZONE, formatDay } from "@/lib/format";

export const metadata: Metadata = { title: "Evento" };

/** Movimientos que se ven sin abrir "anteriores" en la bitácora. */
const LOG_VISIBLE = 25;

// La bitácora se agrupa por día: encabezado con la fecha y, en cada fila, solo la hora.
const LOG_DAY = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: TIME_ZONE });
const LOG_TIME = new Intl.DateTimeFormat("es-MX", { timeStyle: "short", timeZone: TIME_ZONE });

function rawValue(value: CapabilityValue): string {
  if (value.value_boolean !== null) return String(value.value_boolean);
  if (value.value_integer !== null) return String(value.value_integer);
  return value.value_text ?? "";
}

/** admin_assign_to_event agrega al motivo "[cortesía: plan X]", "[complemento X]" o "[Acceso total]". */
const ASSIGN_TAG = /\s*\[(cortesía: )?(plan |complemento )?([^\]]+)\]$/;

/** Origen del valor efectivo: la fuente del permiso y el movimiento activo más reciente que lo dio. */
function originOf(source: string, grant: EventDetail["grants"][number] | undefined): EditorOrigin {
  const base = { by: grant?.grantedBy ?? (source === "admin_override" ? "Sin registro" : "compra"), at: grant?.grantedAt ?? null, reason: grant?.reason ?? null, item: null };
  if (source === "plan") return { ...base, kind: "plan" };
  if (source === "addon") return { ...base, kind: "complemento" };
  const tag = grant?.reason?.match(ASSIGN_TAG);
  if (!tag) return { ...base, kind: "excepcion" };
  const [, courtesy, kind, item] = tag;
  const reason = grant!.reason!.replace(ASSIGN_TAG, "") || null;
  if (kind === "plan ") return { ...base, reason, item, kind: "plan" };
  if (courtesy) return { ...base, reason, item, kind: "cortesia" };
  if (kind === "complemento ") return { ...base, reason, item, kind: "complemento" };
  return { ...base, reason, item, kind: "acceso_total" };
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePermission("eventos.read");
  const { id } = await params;
  // Las cifras (admin_event_detail) pueden fallar sin tumbar la ficha.
  const [event, catalog, editLock, detailResult] = await Promise.all([
    getEventDetail(id),
    getCatalog(),
    getEditLock(id),
    getAdminEventDetail(id).then(
      (value) => ({ value, error: null }),
      (error: unknown) => ({ value: null, error })
    ),
  ]);
  if (!event) notFound();
  const detail: AdminEventDetail | null = detailResult.value;
  const detailError = detailResult.error;

  const entitlementByKey = new Map(event.entitlements.map((row) => [row.capability_key, row]));
  // Lo que "Quitar" revoca: excepciones y complementos dados desde el panel (nunca el plan ni lo comprado).
  const activeOverride = new Set(
    event.grants
      .filter((grant) => grant.fromPanel && grant.source !== "plan" && !grant.revokedAt)
      .map((grant) => grant.capability_key)
  );
  const capabilityName = new Map(catalog.capabilities.map((cap) => [cap.key, cap.name]));
  const itemName = new Map([...catalog.plans, ...catalog.addons].map((item) => [item.key, item.name]));
  const planName = detail?.plan_key ? itemName.get(detail.plan_key) ?? detail.plan_key : null;

  const capabilities: EditorCapability[] = catalog.capabilities.map((cap) => {
    const current = entitlementByKey.get(cap.key);
    // grants vienen del más reciente al más antiguo.
    const grant = current && event.grants.find((row) => row.capability_key === cap.key && row.source === current.source && !row.revokedAt);
    return {
      key: cap.key,
      name: cap.name,
      valueType: cap.valueType,
      enumValues: cap.enumValues,
      description: cap.description,
      current: current ? { label: formatValue(current), raw: rawValue(current), source: current.source } : null,
      origin: current ? originOf(current.source, grant) : null,
      hasOverride: activeOverride.has(cap.key),
    };
  });
  capabilities.sort((a, b) => a.name.localeCompare(b.name, "es"));

  // Si el plan lo dio el panel, el encabezado de heredados dice quién, cuándo y por qué.
  const panelPlan = capabilities.find((cap) => cap.origin?.kind === "plan" && cap.origin.item)?.origin;
  const plan = {
    name: planName ?? panelPlan?.item ?? null,
    note: panelPlan
      ? `Asignado desde el panel por ${panelPlan.by}${panelPlan.at ? ` el ${formatDate(panelPlan.at, true)}` : ""}${panelPlan.reason ? `. Motivo: ${panelPlan.reason}` : ""}`
      : null,
  };

  const toOption = (item: (typeof catalog.plans)[number]): EditorOption => ({
    key: item.key,
    name: item.name,
    isActive: item.isActive,
    summary: formatMxn(item.priceCents),
  });

  const isTour = entitlementByKey.has("choose_plan");
  const place = [event.city, event.state].filter(Boolean).join(", ");
  // Ventas (admin_purchases) por id: enlazan a su ficha y dan el estado mostrado.
  const saleStatus = new Map((detail?.purchases ?? []).map((sale) => [sale.id, sale.display_status]));
  const log = event.grants;
  const unlock = activeUnlock(event.editUnlockedUntil);

  const logRows = (rows: typeof log) =>
    rows.flatMap((grant, index) => {
      const day = LOG_DAY.format(new Date(grant.grantedAt));
      const row = (
        <tr key={grant.id} className={grant.revokedAt ? "text-ink-600" : undefined}>
          <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">{LOG_TIME.format(new Date(grant.grantedAt))}</td>
          <td className="px-3 py-2.5">{capabilityName.get(grant.capability_key) ?? grant.capability_key}</td>
          <td className="px-3 py-2.5 tabular-nums">{formatValue(grant)}</td>
          <td className="max-w-56 px-3 py-2.5">
            {grant.grantedBy === "compra" ? (
              "Compra del cliente"
            ) : (
              <span className="block truncate" title={grant.grantedBy}>
                {grant.grantedBy}
              </span>
            )}
          </td>
          <td className="px-3 py-2.5">{grant.reason ?? <Nil />}</td>
          <td className="px-3 py-2.5">
            {grant.revokedAt ? (
              <div className="flex flex-wrap gap-1">
                <Badge>Revocado {formatDate(grant.revokedAt)}</Badge>
                {grant.revokedReason && <p className="w-full text-xs text-ink-600">{grant.revokedReason}</p>}
              </div>
            ) : null /* Activo es lo normal: solo lo revocado lleva chip. */}
          </td>
        </tr>
      );
      if (index > 0 && LOG_DAY.format(new Date(rows[index - 1].grantedAt)) === day) return [row];
      return [
        <tr key={`dia-${grant.id}`} className="bg-surface-2/60">
          <th colSpan={6} scope="colgroup" className="px-3 py-1.5 text-xs font-medium text-ink-800">
            {day}
          </th>
        </tr>,
        row,
      ];
    });
  const logHead = ["Hora", "Permiso", "Valor", "Quién", "Motivo", "Estado"];
  // En móvil se quedan Fecha, Permiso y Estado.
  const LOG_MOBILE_HIDE = [2, 3, 4];

  // M4: chips en el orden en que las secciones quedan apiladas en móvil (núcleo, lateral, Notas).
  const sections = [
    can(admin, "eventos.permisos") && { id: "permisos", label: "Permisos" },
    { id: "compras", label: "Compras" },
    { id: "bitacora", label: "Bitácora" },
    detail && { id: "resumen", label: "Resumen" },
    { id: "equipo", label: "Dueño y equipo" },
    can(admin, "eventos.desbloquear") && { id: "candado", label: "Edición" },
    { id: "notas", label: "Notas" },
  ].filter((item) => item !== false && item !== null);

  return (
    <>
      <PageTitle
        title={event.name}
        breadcrumb={[{ href: "/eventos", label: "Eventos" }]}
        actions={
          event.owner.id &&
          can(admin, "clientes.ver_como") && (
            // Ver como pide motivo: el enlace lleva a esa sección en la ficha del dueño.
            <Link href={`/clientes/${event.owner.id}#ver-como`} className={ui.buttonSecondary}>
              <Eye size={16} aria-hidden="true" />
              Ver como usuario
            </Link>
          )
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {EVENT_TYPE[event.eventType] ?? event.eventType} · {formatDay(event.eventDate)}
            {place && ` · ${place}`}
            {detail && <EventStatusBadge status={detail.status} />}
            {isTour && <Badge>Prueba gratis</Badge>}
            {event.archived && <Badge>Archivado</Badge>}
          </span>
        }
      />
      <SectionNav items={sections} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-[auto_1fr]">
        {/* Lateral: en móvil sus tarjetas entran a la rejilla (contents) y bajan (order) después del núcleo del evento; Notas va al final. */}
        <aside className="flex min-w-0 flex-col gap-4 max-lg:contents lg:col-start-2 lg:row-[1/span_2]">
          {detail ? (
            <div id="resumen" className="max-lg:order-1">
              <EventSummary detail={detail} />
            </div>
          ) : detailError ? (
            <DataError error={detailError} />
          ) : null}

          <div id="equipo" className="max-lg:order-1">
            <Card title="Dueño y equipo">
              <dl className="flex flex-col gap-3 text-[13px]">
                <div>
                  <dt className="text-ink-600">Dueño</dt>
                  <dd className="mt-0.5 min-w-0">
                    {event.owner.id ? (
                      <Link
                        href={`/clientes/${event.owner.id}`}
                        className="block text-sm font-medium break-words text-ink-950 hover:text-gold-800 hover:underline"
                      >
                        {detail?.owner_name ?? (event.owner.email ? <Email value={event.owner.email} /> : <Nil />)}
                      </Link>
                    ) : (
                      <span className="text-ink-600">{NO_OWNER}</span>
                    )}
                    {event.owner.id && detail?.owner_name && event.owner.email && (
                      <Email value={event.owner.email} className="text-xs text-ink-600" />
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-600">Miembros</dt>
                  <dd className="mt-0.5">
                    {event.members.length === 0 ? (
                      <span className="text-ink-600">Sin miembros</span>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {event.members.map((member) => (
                          <li key={member.profileId} className="flex items-start justify-between gap-2">
                            <Link href={`/clientes/${member.profileId}`} className="min-w-0 flex-1 text-ink-950 hover:text-gold-800 hover:underline">
                              <Email value={member.email || member.profileId} />
                            </Link>
                            <span className="shrink-0 text-xs text-ink-600">{MEMBER_ROLE[member.role] ?? member.role}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-600">ID del evento</dt>
                  <dd className="mt-0.5 font-mono text-xs break-words text-ink-800">{event.id}</dd>
                </div>
              </dl>
            </Card>
          </div>

          {can(admin, "eventos.desbloquear") && (
            <div className="max-lg:order-1">
              <EditLockPanel eventId={event.id} lock={editLock} activeUnlock={unlock} />
            </div>
          )}

          <div id="notas" className="max-lg:order-last">
            <NotesPanel targetType="event" targetId={event.id} />
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-6 lg:col-start-1 lg:row-start-1">
          {detail && <EventFigures detail={detail} planName={planName} lock={editLock} activeUnlock={unlock} />}

          {can(admin, "eventos.permisos") && (
            <PermissionsEditor
              canAssignPlan={can(admin, "eventos.asignar_plan")}
              eventId={event.id}
              capabilities={capabilities}
              plan={plan}
              plans={catalog.plans.map(toOption)}
              addons={catalog.addons.map(toOption)}
            />
          )}

          <div id="compras">
            <Table
              title="Compras"
              head={["Fecha", "Estado", "Conceptos", <span key="total" className="block text-right">Total</span>]}
              mobileHide={[2]}
              mobileCards
              empty={event.purchases.length === 0 ? "Sin compras todavía." : undefined}
            >
              {event.purchases.map((purchase) => {
                const sale = saleStatus.get(purchase.id);
                const concepts = purchase.items.flatMap((item) => (item.key ? [itemName.get(item.key) ?? item.key] : [])).join(", ");
                return (
                  // En móvil toda la tarjeta abre la venta.
                  <tr key={purchase.id} className="max-sm:relative">
                    <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">
                      {sale ? (
                        <Link href={`/ventas/${purchase.id}`} className="font-medium text-gold-800 hover:underline max-sm:after:absolute max-sm:after:inset-0">
                          {formatDate(purchase.createdAt, true)}
                        </Link>
                      ) : (
                        <span className="text-ink-600">{formatDate(purchase.createdAt, true)}</span>
                      )}
                      {/* En móvil la columna Conceptos se oculta: va como segunda línea. */}
                      {concepts && <span className="block text-xs whitespace-normal text-ink-600 sm:hidden">{concepts}</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {purchase.courtesy ? <Badge>Cortesía</Badge> : <PaymentStatusBadge status={sale ?? purchase.status} />}
                    </td>
                    <td className="px-3 py-2.5">{concepts || <Nil />}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatMxn(purchase.totalCents)}</td>
                  </tr>
                );
              })}
            </Table>
          </div>

          <div id="bitacora">
            <Table
              title="Bitácora de permisos"
              head={logHead}
              mobileHide={LOG_MOBILE_HIDE}
              empty={log.length === 0 ? "Sin movimientos registrados." : undefined}
            >
              {logRows(log.slice(0, LOG_VISIBLE))}
            </Table>
            {log.length > LOG_VISIBLE && (
              <details className="group mt-3">
                <summary className="inline-flex min-h-8 max-md:min-h-11 cursor-pointer list-none items-center gap-1 text-[13px] font-medium text-gold-800 hover:underline [&::-webkit-details-marker]:hidden">
                  <ChevronRight size={14} aria-hidden="true" className="transition-transform duration-[var(--dur-fast)] group-open:rotate-90" />
                  Ver {log.length - LOG_VISIBLE} movimientos anteriores
                </summary>
                <div className="mt-2">
                  <Table head={logHead} caption="Bitácora de permisos: movimientos anteriores" mobileHide={LOG_MOBILE_HIDE}>{logRows(log.slice(LOG_VISIBLE))}</Table>
                </div>
              </details>
            )}
          </div>
        </div>

        {/* Borrar va al final también en móvil, después de Notas; en escritorio, bajo la columna principal. */}
        {can(admin, "eventos.borrar") && (
          <div className="min-w-0 max-lg:order-last lg:col-start-1 lg:row-start-2 lg:self-start">
            <DeleteEventPanel eventId={event.id} eventName={event.name} />
          </div>
        )}
      </div>
    </>
  );
}
