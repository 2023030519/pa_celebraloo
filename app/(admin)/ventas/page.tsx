import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { can, requirePermission } from "@/lib/auth/require-admin";
import { listSales } from "@/lib/data/admin";
import { getCatalog } from "@/lib/data/catalog";
import { PAYMENT_STATUS, addDays, formatInt, isoDayOrNull } from "@/lib/format";
import Link from "next/link";
import { HowCalculated, PageTitle, Select, cn, ui } from "@/components/ui";
import { DataError, SalesTable } from "@/components/finance";
import { Field, FilterBar, Pagination, SearchField, fieldClass, pageFrom } from "@/components/filters";

export const metadata: Metadata = { title: "Ventas" };

const PAGE_SIZE = 50;

/** Día real entre 2000 y 2099: "9999-12-31" rompía la RPC y "2026-02-31" se volvía 3 de marzo. */
function dayParam(raw: string | undefined): string | null {
  const day = isoDayOrNull(raw);
  return day && day >= "2000-01-01" && day <= "2099-12-31" && addDays(day, 0) === day ? day : null;
}

type Search = { desde?: string; hasta?: string; estado?: string; producto?: string; q?: string; evento?: string; pagina?: string };

export default async function SalesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const admin = await requirePermission("ventas.read");
  const params = await searchParams;
  const from = dayParam(params.desde);
  const until = dayParam(params.hasta);
  const status = params.estado && params.estado in PAYMENT_STATUS ? params.estado : null;
  const product = params.producto && /^(plan|addon):[a-z0-9_]+$/.test(params.producto) ? params.producto : null;
  const eventId = params.evento && /^[0-9a-f-]{36}$/i.test(params.evento) ? params.evento : null;
  const page = pageFrom(params.pagina);
  const filtered = Boolean(from || until || status || product || eventId || params.q?.trim());

  const catalog = await getCatalog();
  let rows;
  try {
    rows = await listSales({
      from,
      // "hasta" es inclusivo en pantalla; la RPC recibe el día siguiente.
      to: until ? addDays(until, 1) : null,
      status,
      product,
      search: params.q?.trim() || null,
      eventId,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });
  } catch (error) {
    return (
      <>
        <PageTitle title="Ventas" />
        <DataError error={error} />
      </>
    );
  }
  // Una página más allá del final no trae filas ni el total: vuelve a la primera.
  if (rows.length === 0 && page > 1) {
    const query = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1]) && entry[0] !== "pagina"));
    redirect(`/ventas?${query}`);
  }

  const total = rows[0]?.total_count ?? 0;

  return (
    <>
      <PageTitle title="Ventas" subtitle="Todas las compras de Celebraloo" />
      <FilterBar resetHref="/ventas" active={filtered} activeCount={[status, product, from, until].filter(Boolean).length} count={`${formatInt(total)} ${total === 1 ? "venta" : "ventas"}`}>
        <SearchField label="Buscar por cliente o evento" placeholder="Correo, nombre o evento" defaultValue={params.q} />
        <Select name="estado" aria-label="Estado" defaultValue={status ?? ""} size="sm" className="max-md:w-full md:w-44">
          <option value="">Todos los estados</option>
          {Object.entries(PAYMENT_STATUS).map(([key, meta]) => (
            <option key={key} value={key}>
              {meta.label}
            </option>
          ))}
        </Select>
        <Select name="producto" aria-label="Producto" defaultValue={product ?? ""} size="sm" className="max-md:w-full md:w-44">
          <option value="">Todos los productos</option>
          <optgroup label="Planes">
            {catalog.plans.map((plan) => (
              <option key={plan.key} value={`plan:${plan.key}`}>
                {plan.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Complementos">
            {catalog.addons.map((addon) => (
              <option key={addon.key} value={`addon:${addon.key}`}>
                {addon.name}
              </option>
            ))}
          </optgroup>
        </Select>
        <Field label="Desde">
          <input type="date" lang="es-MX" name="desde" defaultValue={from ?? ""} className={cn(fieldClass, "max-md:w-full")} />
        </Field>
        <Field label="Hasta">
          <input type="date" lang="es-MX" name="hasta" defaultValue={until ?? ""} className={cn(fieldClass, "max-md:w-full")} />
        </Field>
        {eventId && <input type="hidden" name="evento" value={eventId} />}
      </FilterBar>
      {eventId && (
        <p className="mb-3 text-[13px] text-ink-600">
          Solo las ventas de un evento.{" "}
          <Link href={`/ventas?${new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1]) && entry[0] !== "evento" && entry[0] !== "pagina"))}`} className={ui.link}>
            Ver todas las ventas
          </Link>
        </p>
      )}
      <SalesTable
        rows={rows}
        financials={can(admin, "ventas.financiero")}
        empty={filtered ? "Ninguna venta coincide con estos filtros. Prueba con Limpiar." : "Aún no hay ventas."}
      />
      <HowCalculated>
        <p>Fecha = cuándo se cobró (o se intentó). Total con IVA incluido; IVA, comisión y neto vienen de Stripe.</p>
      </HowCalculated>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} params={params} basePath="/ventas" hideTotal />
    </>
  );
}
