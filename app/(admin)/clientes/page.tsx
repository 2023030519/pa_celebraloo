import Link from "next/link";
import { requirePermission } from "@/lib/auth/require-admin";
import { listCustomers } from "@/lib/data/admin";
import { getCatalog } from "@/lib/data/catalog";
import { formatMxn } from "@/lib/format";
import { Badge, PageTitle, Table, formatDate } from "@/components/ui";
import { DataError } from "@/components/finance";
import { Field, FilterBar, Pagination, fieldClass, pageFrom } from "@/components/filters";

const PAGE_SIZE = 50;
const FILTERS: Record<string, string> = {
  paying: "De pago",
  free: "Gratuitos",
  disabled: "Deshabilitados",
  staff: "Staff",
};

type Search = { q?: string; filtro?: string; pagina?: string };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePermission("clientes.read");
  const params = await searchParams;
  const filter = params.filtro && params.filtro in FILTERS ? params.filtro : null;
  const page = pageFrom(params.pagina);

  const catalog = await getCatalog();
  const planName = new Map(catalog.plans.map((plan) => [plan.key, plan.name]));
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
      <PageTitle title="Clientes" subtitle="Todas las personas registradas en Celebraloo. Gastado = cobrado menos reembolsado." />
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
        head={["Cliente", "Email", "Registro", "Plan", "Eventos", "Gastado", "Último acceso", "Estado"]}
        empty={rows.length === 0 ? "No hay clientes con esos filtros." : undefined}
      >
        {rows.map((row) => (
          <tr key={row.id} className="hover:bg-paper">
            <td className="px-3 py-2.5">
              <Link href={`/clientes/${row.id}`} className="font-medium hover:underline">
                {row.name ?? "Sin nombre"}
              </Link>
            </td>
            <td className="px-3 py-2.5 text-ink-800">{row.email}</td>
            <td className="px-3 py-2.5 whitespace-nowrap text-ink-600">{formatDate(row.registered_at)}</td>
            <td className="px-3 py-2.5">{row.current_plan_key ? planName.get(row.current_plan_key) ?? row.current_plan_key : "—"}</td>
            <td className="px-3 py-2.5 text-right tabular-nums">{row.events}</td>
            <td className="px-3 py-2.5 text-right tabular-nums">{formatMxn(row.spent_cents)}</td>
            <td className="px-3 py-2.5 whitespace-nowrap text-ink-600">{formatDate(row.last_sign_in_at, true)}</td>
            <td className="px-3 py-2.5">
              <span className="flex flex-wrap gap-1">
                {row.disabled ? <Badge tone="danger">Deshabilitada</Badge> : row.is_paying ? <Badge tone="ok">De pago</Badge> : <Badge>Gratuito</Badge>}
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
