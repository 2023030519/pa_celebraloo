import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth/require-admin";
import { listCustomers } from "@/lib/data/admin";
import { formatInt, formatMxn } from "@/lib/format";
import { Badge, HowCalculated, Nil, PageTitle, Select, Table, cn, formatDate, zeroClass } from "@/components/ui";
import { DataError } from "@/components/finance";
import { FilterBar, Pagination, SearchField, pageFrom } from "@/components/filters";

export const metadata: Metadata = { title: "Clientes" };

const PAGE_SIZE = 50;
const FILTERS: Record<string, string> = {
  paying: "De pago",
  free: "Sin compras",
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

  const total = rows[0]?.total_count ?? 0;

  return (
    <>
      <PageTitle title="Clientes" subtitle="Todas las personas registradas en Celebraloo" />
      <FilterBar
        resetHref="/clientes"
        active={Boolean(params.q || filter)}
        activeCount={filter ? 1 : 0}
        count={`${formatInt(total)} ${total === 1 ? "cliente" : "clientes"}`}
      >
        <SearchField label="Buscar clientes" placeholder="Correo o nombre" defaultValue={params.q} />
        <Select name="filtro" aria-label="Tipo de cliente" defaultValue={filter ?? ""} size="sm" className="w-full md:w-52">
          <option value="">Todos los tipos</option>
          {Object.entries(FILTERS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
      </FilterBar>
      <Table
        head={[
          "Cliente",
          "Fecha de registro",
          <span key="events" className="block text-right">
            Eventos
          </span>,
          <span key="spent" className="block text-right">
            Total gastado
          </span>,
          "Última actividad",
          "Estado",
        ]}
        // Móvil (M2): tarjeta con el cliente a la izquierda y el total gastado a la derecha.
        mobileHide={[1, 2, 4, 5]}
        mobileCards
        empty={
          rows.length === 0
            ? params.q || filter
              ? "Ningún cliente coincide con estos filtros. Usa Limpiar para ver a todos."
              : "Aún no hay clientes registrados."
            : undefined
        }
      >
        {rows.map((row) => {
          // Solo excepciones (R13): "sin compras" no lleva chip, el Total gastado de $0.00 ya lo dice.
          // Staff no es un estado (R22): va como texto apagado junto al nombre.
          const chips = (
            <>
              {row.disabled ? <Badge tone="danger">Suspendida</Badge> : row.is_paying && <Badge>De pago</Badge>}
              {!row.email_confirmed && <Badge tone="warn">Sin confirmar</Badge>}
            </>
          );
          const hasChips = row.disabled || row.is_paying || !row.email_confirmed;
          return (
            <tr key={row.id} className="relative align-top">
              <td className="px-3 py-2.5">
                {/* El tope de ancho va en un div: en una tabla automática el max-w de la celda no corta el texto.
                    En móvil no hay tope: la tarjeta ya acota la celda y el nombre usa todo el ancho libre (R20). */}
                <div className="min-w-0 sm:max-w-[18rem]">
                  {/* Toda la fila abre la ficha: el enlace se estira sobre ella. Persona = nombre y correo debajo (R10). */}
                  <span className="flex min-w-0 items-baseline gap-1.5">
                    <Link
                      href={`/clientes/${row.id}`}
                      title={row.name ?? row.email}
                      className="block min-w-0 truncate font-medium text-ink-950 underline-offset-[3px] after:absolute after:inset-0 hover:underline"
                    >
                      {row.name ?? row.email}
                    </Link>
                    {row.is_staff && <span className="shrink-0 text-xs text-ink-600">Staff</span>}
                  </span>
                  {row.name && (
                    <span title={row.email} className="block truncate text-xs text-ink-600">
                      {row.email}
                    </span>
                  )}
                </div>
                {/* Móvil: la columna Estado se oculta y los chips bajan bajo el correo, como en Usuarios (R13). */}
                {hasChips && <span className="mt-1 flex flex-wrap gap-1 sm:hidden">{chips}</span>}
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap text-ink-600">{formatDate(row.registered_at)}</td>
              <td className={cn("px-3 py-2.5 text-right tabular-nums", zeroClass(row.events))}>{row.events}</td>
              <td className={cn("px-3 py-2.5 text-right tabular-nums", zeroClass(row.spent_cents))}>{formatMxn(row.spent_cents)}</td>
              <td className="px-3 py-2.5 whitespace-nowrap text-ink-600">
                {row.last_activity_at ? formatDate(row.last_activity_at, true) : <Nil label="Sin actividad" />}
              </td>
              <td className="px-3 py-2.5">
                <span className="flex flex-wrap gap-1">{chips}</span>
              </td>
            </tr>
          );
        })}
      </Table>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} params={params} basePath="/clientes" hideTotal />
      <HowCalculated>
        <p>El plan pertenece a cada evento: se ve en la ficha del cliente.</p>
      </HowCalculated>
    </>
  );
}
