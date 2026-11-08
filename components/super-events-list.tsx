import "server-only";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { listAdminEvents } from "@/lib/data/admin";
import { getCatalog } from "@/lib/data/catalog";
import { EVENT_STATUS, EVENT_TYPE, NO_OWNER, formatDay } from "@/lib/format";
import { Badge, HowCalculated, Nil, PageTitle, Select, Table, cn, zeroClass } from "@/components/ui";
import { DataError, EventStatusBadge } from "@/components/finance";
import { Field, FilterBar, Pagination, SearchField, pageFrom } from "@/components/filters";

const PAGE_SIZE = 50;

/** Eventos del Panel V1 (sección 8): estado derivado, plan e invitados sin datos demo. */
export async function SuperEventsList({
  params: { borrado, ...params },
}: {
  /** borrado: llega de borrar un evento (super-actions.ts) para confirmarlo aquí. */
  params: { q?: string; estado?: string; staff?: string; pagina?: string; borrado?: string };
}) {
  const status = params.estado && params.estado in EVENT_STATUS ? params.estado : null;
  const includeStaff = params.staff === "1";
  const page = pageFrom(params.pagina);
  const active = Boolean(params.q?.trim() || status || includeStaff);
  const filtered = active || page > 1;
  const catalog = await getCatalog();
  const planName = new Map(catalog.plans.map((plan) => [plan.key, plan.name]));

  let rows;
  try {
    rows = await listAdminEvents({
      search: params.q?.trim() || null,
      status,
      includeStaff,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });
  } catch (error) {
    return (
      <>
        <PageTitle title="Eventos" />
        <DataError error={error} />
      </>
    );
  }

  const total = rows[0]?.total_count ?? 0;

  return (
    <>
      <PageTitle title="Eventos" subtitle="Eventos de clientes, con su plan, estado e invitados" />
      {borrado && (
        <p role="status" className="mb-4 flex items-center gap-2 rounded-lg border border-ok-300 bg-ok-100 px-3 py-2 text-sm text-ok-700">
          <CheckCircle2 size={16} aria-hidden="true" className="shrink-0" />
          Evento borrado. Quedó en Actividad con su motivo.
        </p>
      )}
      <FilterBar resetHref="/eventos" active={active} activeCount={[status, includeStaff].filter(Boolean).length} count={`${total} ${total === 1 ? "evento" : "eventos"}`}>
        <SearchField label="Buscar por evento, correo del cliente o ID" placeholder="Evento, correo del cliente o ID" defaultValue={params.q} />
        <Field label="Estado">
          <Select name="estado" defaultValue={status ?? ""} size="sm" className="w-40">
            <option value="">Todos</option>
            {Object.entries(EVENT_STATUS).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label}
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex h-11 items-center gap-2 text-xs font-medium text-ink-800 md:h-8">
          <input type="checkbox" name="staff" value="1" defaultChecked={includeStaff} className="size-4 accent-gold-800" />
          Incluir eventos de staff
        </label>
      </FilterBar>
      <Table
        head={[
          "Evento",
          "Cliente",
          "Fecha",
          "Tipo",
          "Plan",
          "Estado",
          <span key="guests" className="block text-right">Invitados</span>,
          <span key="rsvp" className="block text-right">RSVP</span>,
        ]}
        mobileHide={[1, 3, 4, 6, 7]}
        mobileCards
        empty={
          rows.length > 0
            ? undefined
            : filtered
              ? "Ningún evento coincide con estos filtros. Usa Limpiar para ver todos."
              : "Aún no hay eventos de clientes."
        }
      >
        {rows.map((row) => (
          <tr key={row.id} className="relative">
            <td className="px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Link href={`/eventos/${row.id}`} className="font-medium text-ink-950 after:absolute after:inset-0 hover:text-gold-800 hover:underline">
                  {row.name}
                </Link>
                {row.is_staff_owner && <Badge>Staff</Badge>}
              </div>
            </td>
            {/* Persona: nombre arriba y correo abajo, en una celda; sin cortes a media palabra. */}
            <td className="max-w-60 px-3 py-2.5">
              {row.owner_id ? (
                <Link href={`/clientes/${row.owner_id}`} className="relative z-10 block min-w-0 hover:underline">
                  <span className="block truncate text-sm text-ink-950" title={row.owner_name ?? row.owner_email ?? undefined}>
                    {row.owner_name ?? row.owner_email ?? <Nil />}
                  </span>
                  {row.owner_name && row.owner_email && (
                    <span className="block truncate text-xs text-ink-600" title={row.owner_email}>
                      {row.owner_email}
                    </span>
                  )}
                </Link>
              ) : (
                <span className="text-ink-600">{NO_OWNER}</span>
              )}
            </td>
            <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">{formatDay(row.event_date)}</td>
            <td className="px-3 py-2.5 text-ink-800">{EVENT_TYPE[row.event_type] ?? row.event_type}</td>
            <td className="px-3 py-2.5">{row.plan_key ? planName.get(row.plan_key) ?? row.plan_key : "Sin plan"}</td>
            <td className="px-3 py-2.5">
              <EventStatusBadge status={row.status} />
            </td>
            <td className={cn("px-3 py-2.5 text-right tabular-nums", zeroClass(row.guests))}>{row.guests}</td>
            <td className="px-3 py-2.5 text-right text-xs tabular-nums whitespace-nowrap">
              {/* Un conteo en cero va atenuado; el color solo confirma algo real (R21). */}
              <span className={zeroClass(row.rsvp_confirmed, "text-ok-700")}>{row.rsvp_confirmed} sí</span> ·{" "}
              <span className={zeroClass(row.rsvp_pending)}>{row.rsvp_pending} pend.</span> ·{" "}
              <span className={zeroClass(row.rsvp_declined, "text-danger-700")}>{row.rsvp_declined} no</span>
            </td>
          </tr>
        ))}
      </Table>
      <HowCalculated>
        <p>
          El estado se calcula en este orden: Archivado, Finalizado, Próximo (dentro de los días de Configuración), Activo (invitación publicada),
          Configurando y Borrador.
        </p>
      </HowCalculated>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} params={params} basePath="/eventos" hideTotal />
    </>
  );
}
