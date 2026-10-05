import "server-only";
import Link from "next/link";
import { listAdminEvents } from "@/lib/data/admin";
import { getCatalog } from "@/lib/data/catalog";
import { EVENT_STATUS, formatDay } from "@/lib/format";
import { Badge, PageTitle, Table } from "@/components/ui";
import { DataError, EventStatusBadge } from "@/components/finance";
import { Field, FilterBar, Pagination, fieldClass, pageFrom } from "@/components/filters";

const PAGE_SIZE = 50;

/** Eventos del Panel V1 (sección 8): estado derivado, plan e invitados sin datos demo. */
export async function SuperEventsList({ params }: { params: { q?: string; estado?: string; staff?: string; pagina?: string } }) {
  const status = params.estado && params.estado in EVENT_STATUS ? params.estado : null;
  const includeStaff = params.staff === "1";
  const page = pageFrom(params.pagina);
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

  return (
    <>
      <PageTitle
        title="Eventos"
        subtitle="Estado: Archivado › Finalizado › Próximo (≤ 30 días) › Activo (invitación publicada) › Configurando › Borrador."
      />
      <FilterBar resetHref="/eventos">
        <Field label="Buscar">
          <input name="q" defaultValue={params.q ?? ""} placeholder="Evento, correo del cliente o ID" className={`${fieldClass} w-64`} />
        </Field>
        <Field label="Estado">
          <select name="estado" defaultValue={status ?? ""} className={fieldClass}>
            <option value="">Todos</option>
            {Object.entries(EVENT_STATUS).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex h-9 items-center gap-2 text-xs font-semibold text-ink-800">
          <input type="checkbox" name="staff" value="1" defaultChecked={includeStaff} />
          Incluir eventos de staff
        </label>
      </FilterBar>
      <Table
        head={["Evento", "Cliente", "Fecha", "Tipo", "Plan", "Invitados", "RSVP", "Estado"]}
        empty={rows.length === 0 ? "No hay eventos con esos filtros." : undefined}
      >
        {rows.map((row) => (
          <tr key={row.id} className="hover:bg-paper">
            <td className="px-3 py-2.5">
              <Link href={`/eventos/${row.id}`} className="font-medium hover:underline">
                {row.name}
              </Link>
              {row.is_staff_owner && (
                <span className="ml-2">
                  <Badge tone="info">Staff</Badge>
                </span>
              )}
            </td>
            <td className="px-3 py-2.5">
              {row.owner_id ? (
                <Link href={`/clientes/${row.owner_id}`} className="hover:underline">
                  {row.owner_name ?? row.owner_email ?? "—"}
                </Link>
              ) : (
                "—"
              )}
            </td>
            <td className="px-3 py-2.5 whitespace-nowrap">{formatDay(row.event_date)}</td>
            <td className="px-3 py-2.5 text-ink-800">{row.event_type}</td>
            <td className="px-3 py-2.5">{row.plan_key ? planName.get(row.plan_key) ?? row.plan_key : "—"}</td>
            <td className="px-3 py-2.5 text-right tabular-nums">{row.guests}</td>
            <td className="px-3 py-2.5 text-xs tabular-nums whitespace-nowrap">
              <span className="text-ok-700">{row.rsvp_confirmed} sí</span> · {row.rsvp_pending} pend. ·{" "}
              <span className="text-danger-700">{row.rsvp_declined} no</span>
            </td>
            <td className="px-3 py-2.5">
              <EventStatusBadge status={row.status} />
            </td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} pageSize={PAGE_SIZE} total={rows[0]?.total_count ?? 0} params={params} basePath="/eventos" />
    </>
  );
}
