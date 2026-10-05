import { requireSuperAdmin } from "@/lib/auth/require-admin";
import { listSales } from "@/lib/data/admin";
import { getCatalog } from "@/lib/data/catalog";
import { PAYMENT_STATUS, addDays, isoDayOrNull } from "@/lib/format";
import { PageTitle } from "@/components/ui";
import { DataError, SalesTable } from "@/components/finance";
import { Field, FilterBar, Pagination, fieldClass, pageFrom } from "@/components/filters";

const PAGE_SIZE = 50;

type Search = { desde?: string; hasta?: string; estado?: string; producto?: string; q?: string; evento?: string; pagina?: string };

export default async function SalesPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireSuperAdmin();
  const params = await searchParams;
  const from = isoDayOrNull(params.desde);
  const until = isoDayOrNull(params.hasta);
  const status = params.estado && params.estado in PAYMENT_STATUS ? params.estado : null;
  const product = params.producto && /^(plan|addon):[a-z0-9_]+$/.test(params.producto) ? params.producto : null;
  const eventId = params.evento && /^[0-9a-f-]{36}$/i.test(params.evento) ? params.evento : null;
  const page = pageFrom(params.pagina);

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

  return (
    <>
      <PageTitle
        title="Ventas"
        subtitle="Todas las compras de Celebraloo. Fecha = cuándo se cobró (o se intentó). IVA, comisión y neto vienen de Stripe."
      />
      <FilterBar resetHref="/ventas">
        <Field label="Desde">
          <input type="date" name="desde" defaultValue={from ?? ""} className={fieldClass} />
        </Field>
        <Field label="Hasta">
          <input type="date" name="hasta" defaultValue={until ?? ""} className={fieldClass} />
        </Field>
        <Field label="Estado">
          <select name="estado" defaultValue={status ?? ""} className={fieldClass}>
            <option value="">Todos</option>
            {Object.entries(PAYMENT_STATUS).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Producto">
          <select name="producto" defaultValue={product ?? ""} className={fieldClass}>
            <option value="">Todos</option>
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
          </select>
        </Field>
        <Field label="Cliente o evento">
          <input name="q" defaultValue={params.q ?? ""} placeholder="Correo, nombre o evento" className={`${fieldClass} w-56`} />
        </Field>
        {eventId && <input type="hidden" name="evento" value={eventId} />}
      </FilterBar>
      <SalesTable rows={rows} empty="No hay ventas con esos filtros." />
      <Pagination page={page} pageSize={PAGE_SIZE} total={rows[0]?.total_count ?? 0} params={params} basePath="/ventas" />
    </>
  );
}
