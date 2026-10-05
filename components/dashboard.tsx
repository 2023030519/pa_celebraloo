import "server-only";
import Link from "next/link";
import { can, type AdminSession } from "@/lib/auth/require-admin";
import { Card, cn } from "@/components/ui";
import { DataError, SalesTable } from "@/components/finance";
import { AlertList, SeverityTotals } from "@/components/alerts";
import { Delta, KpiTile } from "@/components/kpi";
import { MetricChart, type ChartBucket } from "@/components/metric-chart";
import {
  getAlertCounts,
  getAlerts,
  getFinanceSummary,
  getMonthToDate,
  getOperationalKpis,
  getProductMix,
  getSeries,
  listSales,
  type MonthMetric,
  type MonthToDateRow,
  type SeriesMetric,
} from "@/lib/data/admin";
import { addDays, dayRangeLabel, formatBps, formatInt, formatMxn, monthLabel, shiftMonth, todayMx } from "@/lib/format";

export type DashboardParams = { rango?: string; metrica?: string };

const RANGES = {
  "7d": { label: "7 días", bucket: "day" },
  "30d": { label: "30 días", bucket: "day" },
  "3m": { label: "3 meses", bucket: "week" },
  "12m": { label: "12 meses", bucket: "month" },
} as const satisfies Record<string, { label: string; bucket: ChartBucket }>;
type RangeKey = keyof typeof RANGES;

const METRICS = {
  ingresos: { label: "Ingresos", rpc: "ingresos", money: true },
  ventas: { label: "Número de ventas", rpc: "ventas", money: false },
  clientes: { label: "Clientes nuevos", rpc: "clientes_nuevos", money: false },
} as const satisfies Record<string, { label: string; rpc: SeriesMetric; money: boolean }>;
type MetricKey = keyof typeof METRICS;

/** [desde, hasta) del rango: siempre termina hoy (CDMX). 3 meses = 13 semanas; 12 meses = desde el 1.º de hace 11 meses. */
function rangeDates(key: RangeKey, today: string): { from: string; to: string } {
  const to = addDays(today, 1);
  if (key === "7d") return { from: addDays(today, -6), to };
  if (key === "30d") return { from: addDays(today, -29), to };
  if (key === "3m") return { from: addDays(today, -90), to };
  return { from: `${shiftMonth(today.slice(0, 7), -11)}-01`, to };
}

function Segmented<K extends string>({
  label,
  options,
  current,
  href,
}: {
  label: string;
  options: [K, string][];
  current: K;
  href: (key: K) => string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-md border border-ink-250 bg-surface p-0.5">
      {options.map(([key, text]) => (
        <Link
          key={key}
          href={href(key)}
          scroll={false}
          aria-current={key === current ? "true" : undefined}
          className={cn(
            "rounded px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
            key === current ? "bg-ink-950 text-surface" : "text-ink-800 hover:bg-paper"
          )}
        >
          {text}
        </Link>
      ))}
    </div>
  );
}

/** Inicio (todas las áreas del panel). Las cifras de dinero solo llegan con finanzas.read. */
export async function Dashboard({ admin, params }: { admin: AdminSession; params: DashboardParams }) {
  const money = can(admin, "finanzas.read");
  const today = todayMx();
  const month = today.slice(0, 7);
  const monthFrom = `${month}-01`;
  const tomorrow = addDays(today, 1);

  const rangeKey: RangeKey = params.rango && params.rango in RANGES ? (params.rango as RangeKey) : "30d";
  const metricOptions = (Object.keys(METRICS) as MetricKey[]).filter((key) => money || !METRICS[key].money);
  const metricKey: MetricKey =
    params.metrica && metricOptions.includes(params.metrica as MetricKey) ? (params.metrica as MetricKey) : metricOptions[0];
  const range = RANGES[rangeKey];
  const { from, to } = rangeDates(rangeKey, today);

  let data;
  try {
    const [mtd, kpis, summary, series, mix, alertCounts, topAlerts, latest] = await Promise.all([
      getMonthToDate(),
      getOperationalKpis(monthFrom, tomorrow),
      money ? getFinanceSummary(monthFrom, tomorrow) : Promise.resolve(null),
      getSeries(from, to, range.bucket, METRICS[metricKey].rpc),
      getProductMix(from, to),
      can(admin, "alertas.read") ? getAlertCounts() : Promise.resolve([]),
      can(admin, "alertas.read") ? getAlerts(null, 5) : Promise.resolve([]),
      listSales({ from: null, to: null, status: null, product: null, search: null, eventId: null, limit: 6, offset: 0 }),
    ]);
    data = { mtd, kpis, summary, series, mix, alertCounts, topAlerts, latest };
  } catch (error) {
    return (
      <>
        <DashboardTitle month={month} />
        <DataError error={error} />
      </>
    );
  }

  const { mtd, kpis, summary, series, mix, alertCounts, topAlerts, latest } = data;
  const row = (metric: MonthMetric): MonthToDateRow | undefined => mtd.get(metric);
  const anyRow = mtd.values().next().value;
  const compareLabel = anyRow
    ? `${dayRangeLabel(anyRow.actual_desde, anyRow.actual_hasta)} contra ${dayRangeLabel(anyRow.anterior_desde, anyRow.anterior_hasta)}`
    : null;
  const totalAlerts = alertCounts.reduce((sum, count) => sum + count.total, 0);
  const plans = mix.filter((item) => item.item_type === "plan");
  const addons = mix.filter((item) => item.item_type === "addon").slice(0, 5);
  const metric = METRICS[metricKey];
  const href = (next: { rango?: string; metrica?: string }) => {
    const query = new URLSearchParams({ rango: next.rango ?? rangeKey, metrica: next.metrica ?? metricKey });
    return `/?${query.toString()}`;
  };
  const sales = row("ventas")?.actual ?? 0;

  return (
    <>
      <DashboardTitle month={month} compareLabel={compareLabel} />

      {/* Fila 1: lo que más importa del mes, con su variación. */}
      <section aria-labelledby="row-main" className="mb-3">
        <h2 id="row-main" className="sr-only">
          Cifras principales del mes
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {money ? (
            <KpiTile
              label="Ingresos del mes"
              value={formatMxn(row("ingresos")?.actual)}
              footer={<Delta row={row("ingresos")} />}
              href="/finanzas"
            />
          ) : (
            <KpiTile
              label="Clientes nuevos del mes"
              value={formatInt(row("clientes_nuevos")?.actual)}
              footer={<Delta row={row("clientes_nuevos")} />}
              href="/clientes"
            />
          )}
          <KpiTile
            label="Ventas del mes"
            value={formatInt(sales)}
            footer={<Delta row={row("ventas")} />}
            hint={sales === 0 ? "Aún no hay ventas este mes." : undefined}
            href="/ventas"
          />
          <KpiTile
            label="Clientes de pago"
            value={formatInt(row("clientes_de_pago")?.actual)}
            footer={<Delta row={row("clientes_de_pago")} />}
            href="/clientes?filtro=paying"
          />
          {money ? (
            <KpiTile
              label="Dinero realmente disponible"
              value={formatMxn(row("dinero_disponible")?.actual)}
              footer={<Delta row={row("dinero_disponible")} />}
              hint="Acumulado. No es el saldo del banco."
              emphasis
              href="/finanzas"
            />
          ) : (
            <KpiTile
              label="Eventos creados del mes"
              value={formatInt(row("eventos_creados")?.actual)}
              footer={<Delta row={row("eventos_creados")} />}
              href="/eventos"
            />
          )}
        </div>
      </section>

      {/* Fila 2: operación (peso medio). */}
      <section aria-labelledby="row-ops" className="mb-3">
        <h2 id="row-ops" className="sr-only">
          Operación
        </h2>
        <div className={cn("grid grid-cols-2 gap-3", money ? "xl:grid-cols-4" : "xl:grid-cols-3")}>
          <KpiTile size="md" label="Eventos activos" value={formatInt(kpis.eventos_activos)} hint="Con invitación publicada y fecha por venir." href="/eventos" />
          <KpiTile size="md" label="Eventos próximos (30 días)" value={formatInt(kpis.eventos_proximos)} href="/eventos?estado=proximo" />
          <KpiTile
            size="md"
            label="Conversión gratis a pago"
            value={row("conversion_bps")?.actual === null ? "—" : formatBps(row("conversion_bps")?.actual)}
            hint={
              row("conversion_bps")?.actual === null
                ? "Aún no hay registros este mes."
                : "De quienes se registraron este mes, cuántos ya compraron."
            }
          />
          {money && (
            <KpiTile
              size="md"
              label="Ticket promedio"
              value={formatMxn(row("ticket_promedio")?.actual)}
              hint={row("ticket_promedio")?.actual === null ? "Aún no hay ventas este mes." : "Ingresos entre ventas del mes."}
            />
          )}
        </div>
      </section>

      {/* Información secundaria (peso bajo). */}
      {summary && (
        <section aria-labelledby="row-secondary" className="mb-6">
          <h2 id="row-secondary" className="sr-only">
            Detalle del mes
          </h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg border border-ink-150 bg-surface-2/50 px-4 py-2 text-xs sm:grid-cols-4">
            <SecondaryFigure label="IVA cobrado" cents={summary.iva_cobrado_cents} />
            <SecondaryFigure label="Comisiones de Stripe" cents={summary.comisiones_stripe_cents} />
            <SecondaryFigure label="Gastos" cents={summary.gastos_total_cents} />
            <SecondaryFigure label="Utilidad (resultado operativo)" cents={summary.resultado_operativo_cents} />
          </dl>
          {summary.ventas_sin_datos_financieros > 0 && (
            <p className="mt-2 text-xs text-warn-700">
              {summary.ventas_sin_datos_financieros} ventas del mes aún no tienen la comisión de Stripe registrada: comisiones,
              utilidad y disponible están incompletos.
            </p>
          )}
        </section>
      )}
      {!summary && <div className="mb-6" />}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card
          title={
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {metric.label} · {range.label}
              </span>
              <span className="flex flex-wrap gap-2">
                {metricOptions.length > 1 && (
                  <Segmented
                    label="Métrica"
                    options={metricOptions.map((key) => [key, METRICS[key].label] as [MetricKey, string])}
                    current={metricKey}
                    href={(key) => href({ metrica: key })}
                  />
                )}
                <Segmented
                  label="Rango"
                  options={(Object.keys(RANGES) as RangeKey[]).map((key) => [key, RANGES[key].label] as [RangeKey, string])}
                  current={rangeKey}
                  href={(key) => href({ rango: key })}
                />
              </span>
            </span>
          }
        >
          <MetricChart
            points={series.map((point) => ({ start: point.bucket_start, end: point.bucket_end, value: point.value }))}
            bucket={range.bucket}
            money={metric.money}
            metricLabel={metric.label}
            emptyText={`Sin ${metric.label.toLowerCase()} en los últimos ${range.label}.`}
          />
          <p className="mt-1 text-xs text-ink-600">
            {range.bucket === "day" ? "Por día" : range.bucket === "week" ? "Por semana (lunes a domingo)" : "Por mes"}. Ingresos =
            cobrado menos reembolsos y contracargos.
          </p>
        </Card>

        {can(admin, "alertas.read") && (
          <Card
            title={
              <span className="flex items-center justify-between gap-2">
                Requiere atención
                <Link href="/alertas" className="text-xs font-semibold text-gold-800 hover:underline">
                  {totalAlerts > 0 ? `Ver las ${formatInt(totalAlerts)}` : "Ver centro de alertas"}
                </Link>
              </span>
            }
          >
            <SeverityTotals counts={alertCounts} />
            <div className="mt-3">
              <AlertList items={topAlerts} empty="Sin alertas: todo en orden." />
            </div>
          </Card>
        )}

        <Card title={`Ventas por plan · ${range.label}`}>
          {plans.length === 0 ? (
            <p className="text-ink-600">Aún no hay ventas de planes en este periodo.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {plans.map((plan) => (
                <li key={plan.item_key}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{plan.item_name}</span>
                    <span className="tabular-nums text-ink-800">
                      {formatInt(plan.numero_ventas)} {plan.numero_ventas === 1 ? "venta" : "ventas"} ·{" "}
                      <span className="font-semibold text-ink-950">{formatBps(plan.porcentaje_bps)}</span>
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-surface-2" aria-hidden="true">
                    <div className="h-2 rounded-full" style={{ width: `${plan.porcentaje_bps / 100}%`, background: "#a67c2e" }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <h3 className="mt-5 mb-2 border-t border-ink-150 pt-4 text-[13px] font-semibold">Complementos más vendidos</h3>
          {addons.length === 0 ? (
            <p className="text-ink-600">Aún no hay ventas de complementos en este periodo.</p>
          ) : (
            <ol className="flex flex-col gap-1.5">
              {addons.map((addon, index) => (
                <li key={addon.item_key} className="flex items-baseline justify-between gap-2">
                  <span>
                    <span className="mr-2 text-xs tabular-nums text-ink-600">{index + 1}.</span>
                    {addon.item_name}
                  </span>
                  <span className="tabular-nums text-ink-800">
                    {formatInt(addon.numero_ventas)} · {formatBps(addon.porcentaje_bps)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-[13px] font-semibold">Últimas ventas</h2>
            <Link href="/ventas" className="text-xs font-semibold text-gold-800 hover:underline">
              Ver todas
            </Link>
          </div>
          <SalesTable rows={latest} compact empty="Aún no hay ventas." />
        </div>
      </div>
    </>
  );
}

function DashboardTitle({ month, compareLabel }: { month: string; compareLabel?: string | null }) {
  return (
    <div className="mb-5">
      <h1 className="text-xl font-semibold text-ink-950">Inicio</h1>
      <p className="mt-1 text-ink-600">
        {monthLabel(month)}
        {compareLabel && ` · variación: ${compareLabel}`} · sin cuentas de staff, datos demo ni cortesías.
      </p>
    </div>
  );
}

function SecondaryFigure({ label, cents }: { label: string; cents: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1 sm:block">
      <dt className="text-ink-600">{label}</dt>
      <dd className="font-semibold tabular-nums text-ink-800">{formatMxn(cents)}</dd>
    </div>
  );
}
