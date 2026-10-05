import Link from "next/link";
import { requirePermission } from "@/lib/auth/require-admin";
import { listCustomers } from "@/lib/data/admin";
import { formatMxn } from "@/lib/format";
import { Badge, PageTitle, Table, formatDate } from "@/components/ui";
import { DataError } from "@/components/finance";
import { Field, FilterBar, Pagination, fieldClass, pageFrom } from "@/components/filters";

const PAGE_SIZE = 50;
const FILTERS: Record<string, string> = {
  paying: "De pago",
  free: "Gratuitos",
  disabled: "Suspendidos",
  unconfirmed: "Correo sin confirmar",
  staff: "Staff",
};

type Search = { q?: string; filtro?: string; pagina?: string };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePermission("clientes.read");
  const params = await searchParams;
  const filter = params.filtro && params.filtro in FILTERS ? params.filtro : null;
  const page = pageFrom(params.pagina);

  let rows;
  try {
    rows = await listCustomers({ search: params.q?.trim() || null, filter, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  } catch (error) {
    return (
      <>
        <PageTitle title="Clientes" />
        <DataError error={error} />
      </>
    );
  }

  return (
    <>
      <PageTitle
        title="Clientes"
        subtitle="Todas las personas registradas en Celebraloo. El plan pertenece a cada evento: se ve en la ficha del cliente."
      />
      <FilterBar resetHref="/clientes">
        <Field label="Buscar">
          <input name="q" defaultValue={params.q ?? ""} placeholder="Correo o nombre" className={`${fieldClass} w-64`} />
        </Field>
        <Field label="Tipo">
          <select name="filtro" defaultValue={filter ?? ""} className={fieldClass}>
            <option value="">Todos</option>
            {Object.entries(FILTERS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </FilterBar>
      <Table
        head={["Cliente", "Email", "Fecha de registro", "Eventos", "Total gastado", "Último acceso", "Estado"]}
        empty={
          rows.length === 0 ? (params.q || filter ? "No hay clientes con esos filtros." : "Aún no hay clientes registrados.") : undefined
        }
      >
        {rows.map((row) => (
          <tr key={row.id} className="relative hover:bg-paper">
            <td className="px-3 py-2.5">
              {/* Toda la fila abre la ficha: el enlace se estira sobre ella. */}
              <Link href={`/clientes/${row.id}`} className="font-medium after:absolute after:inset-0 hover:underline">
                {row.name ?? "Sin nombre"}
              </Link>
            </td>
            <td className="px-3 py-2.5 text-ink-800">{row.email}</td>
            <td className="px-3 py-2.5 whitespace-nowrap text-ink-600">{formatDate(row.registered_at)}</td>
            <td className="px-3 py-2.5 text-right tabular-nums">{row.events}</td>
            <td className="px-3 py-2.5 text-right tabular-nums">{formatMxn(row.spent_cents)}</td>
            <td className="px-3 py-2.5 whitespace-nowrap text-ink-600">
              {row.last_activity_at ? formatDate(row.last_activity_at, true) : "Nunca"}
            </td>
            <td className="px-3 py-2.5">
              <span className="flex flex-wrap gap-1">
                {row.disabled ? <Badge tone="danger">Suspendida</Badge> : row.is_paying ? <Badge tone="ok">De pago</Badge> : <Badge>Gratuito</Badge>}
                {!row.email_confirmed && <Badge tone="warn">Sin confirmar</Badge>}
                {row.is_staff && <Badge tone="info">Staff</Badge>}
              </span>
            </td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} pageSize={PAGE_SIZE} total={rows[0]?.total_count ?? 0} params={params} basePath="/clientes" />
    </>
  );
}
