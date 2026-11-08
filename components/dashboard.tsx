import "server-only";
import Link from "next/link";
import { can, type AdminSession } from "@/lib/auth/require-admin";
import { HowCalculated, Nil, Segmented, cn } from "@/components/ui";
import { DataError, SalesTable } from "@/components/finance";
import { AlertList, SeverityTotals } from "@/components/alerts";
import { Delta, Figure, FigureRow, FigureStrip } from "@/components/kpi";
import { MetricChart, type ChartBucket } from "@/components/metric-chart";
import {
  getAlertCounts,
  getAlerts,
  getFinanceSummary,
  getMonthToDate,
  getOperationalKpis,
  getSeries,
  listAdminEvents,
  listSales,
  type MonthMetric,
  type MonthToDateRow,
  type SeriesMetric,
} from "@/lib/data/admin";
import { addDays, dayRangeLabel, formatBps, formatDay, formatInt, formatMxn, monthLabel, shiftMonth, todayMx } from "@/lib/format";

export type DashboardParams = { rango?: string; metrica?: string };

const RANGES = {
  "7d": { label: "7 días", bucket: "day" },
  "30d": { label: "30 días", bucket: "day" },
  "3m": { label: "3 meses", bucket: "week" },
  "12m": { label: "12 meses", bucket: "month" },
} as const satisfies Record<string, { label: string; bucket: ChartBucket }>;
type RangeKey = keyof typeof RANGES;

const METRICS = {
  ingresos: { label: "Dinero recibido", rpc: "ingresos", money: true },
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

  const showEvents = can(admin, "eventos.read");
  // Cada bloque con su propio error: una consulta lenta (statement timeout) no tira toda la página.
  const [mtdR, kpisR, summaryR, seriesR, eventsR, alertCountsR, topAlertsR, latestR] = await Promise.allSettled([
    getMonthToDate(),
    getOperationalKpis(monthFrom, tomorrow),
    money ? getFinanceSummary(monthFrom, tomorrow) : Promise.resolve(null),
    getSeries(from, to, range.bucket, METRICS[metricKey].rpc),
    showEvents ? listAdminEvents({ search: null, status: "proximo", includeStaff: false, limit: 50, offset: 0 }) : Promise.resolve([]),
    can(admin, "alertas.read") ? getAlertCounts() : Promise.resolve([]),
    can(admin, "alertas.read") ? getAlerts(null, 5) : Promise.resolve([]),
    // De sobra para quedarse con 6 cobradas (abajo se quitan los checkouts sin cobrar).
    listSales({ from: null, to: null, status: null, product: null, search: null, eventId: null, limit: 30, offset: 0 }),
  ]);
  const mtd = ok(mtdR);
  const kpis = ok(kpisR);
  const summary = ok(summaryR);
  const series = ok(seriesR);
  // Los 5 más cercanos; sin fecha al final.
  const upcoming = (ok(eventsR) ?? [])
    .toSorted((a, b) => (a.event_date ?? "9999").localeCompare(b.event_date ?? "9999"))
    .slice(0, 5);
  const alertCounts = ok(alertCountsR) ?? [];
  const topAlerts = ok(topAlertsR) ?? [];
  // Mismo criterio que "Ventas del mes": solo lo cobrado (pendientes, fallidas y no completadas no son ventas).
  const latest = ok(latestR)?.filter((sale) => !["pending", "failed", "cancelled"].includes(sale.display_status)).slice(0, 6);

  const row = (metric: MonthMetric): MonthToDateRow | undefined => mtd?.get(metric);
  const anyRow = mtd?.values().next().value;
  const compareLabel = anyRow
    ? `${dayRangeLabel(anyRow.actual_desde, anyRow.actual_hasta)} contra ${dayRangeLabel(anyRow.anterior_desde, anyRow.anterior_hasta)}`
    : null;
  const totalAlerts = alertCounts.reduce((sum, count) => sum + count.total, 0);
  const metric = METRICS[metricKey];
  const href = (next: { rango?: string; metrica?: string }) => {
    const query = new URLSearchParams({ rango: next.rango ?? rangeKey, metrica: next.metrica ?? metricKey });
    return `/?${query.toString()}`;
  };
  const sales = row("ventas")?.actual ?? 0;
  // Las cifras de la franja que llevan variación; sin mes anterior se dice una vez, no en cada cifra.
  const deltaMetrics: MonthMetric[] = money
    ? ["ingresos", "ventas", "clientes_de_pago", "dinero_disponible"]
    : ["clientes_nuevos", "ventas", "clientes_de_pago", "eventos_creados"];
  const missingPrevious = deltaMetrics.some((metric) => row(metric)?.variacion_bps === null);

  const showAlerts = can(admin, "alertas.read");

  return (
    <>
      <DashboardTitle month={month} compareLabel={compareLabel} />

      {/* 1. Lo que requiere atención, antes que las cifras (patrón de Stripe Home). */}
      {showAlerts && (
        <section aria-labelledby="attention" className="mb-6 rounded-lg border border-ink-150 bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-150 px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="attention" className="text-base font-semibold text-ink-950">
                Requiere atención
              </h2>
              {alertCountsR.status === "fulfilled" && <SeverityTotals counts={alertCounts} />}
            </div>
            <Link href="/alertas" className={seeAllClass}>
              {totalAlerts > 0 ? `Ver todas (${formatInt(totalAlerts)})` : "Ver centro de alertas"}
            </Link>
          </div>
          <div className="px-4 py-1">
            {alertCountsR.status === "rejected" || topAlertsR.status === "rejected" ? (
              <div className="py-3">
                <DataError error={failure(alertCountsR, topAlertsR)} />
              </div>
            ) : (
              <AlertList items={topAlerts.slice(0, 3)} empty="Sin alertas: todo en orden." />
            )}
          </div>
        </section>
      )}

      {/* 2. Franja de cifras: principales y operación, de más a menos peso. El desglose del dinero vive en Finanzas. */}
      <h2 className="sr-only">Cifras del mes</h2>
      <div className="mb-6">
        {!mtd ? (
          <DataError error={failure(mtdR)} />
        ) : (
          <FigureStrip>
            <FigureRow cols={4} label="Cifras principales del mes">
              {money ? (
                <Figure
                  label="Dinero recibido del mes"
                  value={formatMxn(row("ingresos")?.actual)}
                  footer={<Delta row={row("ingresos")} />}
                  hint="IVA incluido."
                  href="/finanzas"
                />
              ) : (
                <Figure
                  label="Clientes nuevos del mes"
                  value={formatInt(row("clientes_nuevos")?.actual)}
                  footer={<Delta row={row("clientes_nuevos")} />}
                  href="/clientes"
                />
              )}
              <Figure
                label="Ventas del mes"
                value={formatInt(sales)}
                footer={<Delta row={row("ventas")} />}
                hint={sales === 0 ? "Aún no hay ventas cobradas este mes." : undefined}
                href="/ventas"
              />
              <Figure
                label="Clientes de pago"
                value={formatInt(row("clientes_de_pago")?.actual)}
                footer={<Delta row={row("clientes_de_pago")} />}
                href="/clientes?filtro=paying"
              />
              {money ? (
                <Figure
                  label="Disponible"
                  value={formatMxn(row("dinero_disponible")?.actual)}
                  footer={<Delta row={row("dinero_disponible")} />}
                  hint="Acumulado y calculado; no es el saldo del banco."
                  emphasis
                  href="/finanzas"
                />
              ) : (
                <Figure
                  label="Eventos creados del mes"
                  value={formatInt(row("eventos_creados")?.actual)}
                  footer={<Delta row={row("eventos_creados")} />}
                  href="/eventos"
                />
              )}
            </FigureRow>
            {!kpis ? (
              <div className="bg-surface px-5 py-3">
                <DataError error={failure(kpisR)} />
              </div>
            ) : (
              <FigureRow cols={money ? 4 : 3} label="Operación">
                <Figure size="sm" label="Eventos activos" value={formatInt(kpis.eventos_activos)} href="/eventos" />
                <Figure size="sm" label="Eventos próximos" value={formatInt(kpis.eventos_proximos)} href="/eventos?estado=proximo" />
                <Figure
                  size="sm"
                  label="Conversión a pago"
                  value={row("conversion_bps")?.actual === null ? <Nil /> : formatBps(row("conversion_bps")?.actual)}
                />
                {money && (
                  <Figure
                    size="sm"
                    label="Ticket promedio"
                    value={row("ticket_promedio")?.actual === null ? <Nil /> : formatMxn(row("ticket_promedio")?.actual)}
                  />
                )}
              </FigureRow>
            )}
          </FigureStrip>
        )}
        {summary && summary.ventas_sin_datos_financieros > 0 && (
          <p className="mt-2 text-xs text-warn-700">
            {summary.ventas_sin_datos_financieros} ventas del mes aún no tienen la comisión de Stripe registrada: comisiones,
            utilidad y disponible están incompletos.
          </p>
        )}
        {mtd && missingPrevious && <p className="mt-2 text-xs text-ink-600">Sin datos del mes anterior para comparar algunas cifras.</p>}
        {/* El único "Cómo se calcula" de Inicio: también define el Dinero recibido de la gráfica. */}
        <HowCalculated>
          <p>Las cifras no incluyen cuentas de staff, datos demo ni cortesías.</p>
          {money && <p>Dinero recibido = cobrado − reembolsos − contracargos, IVA incluido.</p>}
          <p>Conversión a pago: conversión de registro a pago en el mes.</p>
          {compareLabel && <p>Variación: {compareLabel}.</p>}
        </HowCalculated>
        {summaryR.status === "rejected" && (
          <div className="mt-2">
            <DataError error={summaryR.reason} />
          </div>
        )}
      </div>

      {/* 3. Tendencia y eventos próximos. Sin eventos.read, la gráfica ocupa todo el ancho. */}
      <div className={cn("mb-6 grid grid-cols-1 items-start gap-6", showEvents && "xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]")}>
        <section aria-labelledby="trend" className="min-w-0 rounded-lg border border-ink-150 bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-150 px-4 py-3">
            <h2 id="trend" className="text-base font-semibold text-ink-950">
              {metric.label} · {range.label}
            </h2>
            <div className="flex min-w-0 max-w-full flex-wrap gap-2">
              {metricOptions.length > 1 && (
                <Segmented
                  label="Métrica"
                  options={metricOptions.map((key) => [key, METRICS[key].label] as [MetricKey, string])}
                  current={metricKey}
                  href={(key) => href({ metrica: key })}
                  wrap
                />
              )}
              <Segmented
                label="Rango"
                options={(Object.keys(RANGES) as RangeKey[]).map((key) => [key, RANGES[key].label] as [RangeKey, string])}
                current={rangeKey}
                href={(key) => href({ rango: key })}
                wrap
              />
            </div>
          </div>
          <div className="p-4">
            {series ? (
              <MetricChart
                points={series.map((point) => ({ start: point.bucket_start, end: point.bucket_end, value: point.value }))}
                bucket={range.bucket}
                money={metric.money}
                metricLabel={metric.label}
                emptyText={`Sin ${metric.label.toLowerCase()} en los últimos ${range.label}.`}
                unit={range.bucket === "day" ? "Por día" : range.bucket === "week" ? "Por semana (lunes a domingo)" : "Por mes"}
              />
            ) : (
              <DataError error={failure(seriesR)} />
            )}
          </div>
        </section>

        {showEvents && (
          <section aria-labelledby="upcoming" className="rounded-lg border border-ink-150 bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-150 px-4 py-3">
              <h2 id="upcoming" className="text-base font-semibold text-ink-950">
                Eventos próximos
              </h2>
              <Link href="/eventos?estado=proximo" className={seeAllClass}>
                Ver todos
              </Link>
            </div>
            {eventsR.status === "rejected" ? (
              <div className="p-4">
                <DataError error={eventsR.reason} />
              </div>
            ) : upcoming.length === 0 ? (
              <p className="px-4 py-6 text-ink-600">Sin eventos próximos.</p>
            ) : (
              <ul className="divide-y divide-ink-150">
                {upcoming.map((event) => (
                  <li key={event.id} className="relative px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      {/* M2: en móvil toda la fila abre el evento. */}
                      <Link href={`/eventos/${event.id}`} className="min-w-0 truncate font-medium text-ink-950 hover:underline max-md:after:absolute max-md:after:inset-0">
                        {event.name}
                      </Link>
                      <span className="shrink-0 tabular-nums text-ink-600">{formatDay(event.event_date)}</span>
                    </div>
                    <p className="truncate text-xs text-ink-600" title={event.owner_email ?? undefined}>
                      {event.owner_name ?? event.owner_email ?? "Sin dueño"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      {/* 4. Últimas ventas, a todo el ancho. */}
      {latest ? (
        <SalesTable
          rows={latest}
          compact
          title="Últimas ventas"
          aside={
            <Link href="/ventas" className={seeAllClass}>
              Ver todas
            </Link>
          }
          empty="Aún no hay ventas cobradas."
        />
      ) : (
        <section aria-labelledby="latest">
          <h2 id="latest" className="mb-2 text-base font-semibold text-ink-950">
            Últimas ventas
          </h2>
          <DataError error={failure(latestR)} />
        </section>
      )}
    </>
  );
}

// M6: en móvil el enlace del encabezado de cada bloque mide 44 px sin agrandar el encabezado.
const seeAllClass = "text-[13px] font-medium text-gold-800 hover:underline max-md:-my-3 max-md:inline-flex max-md:min-h-11 max-md:items-center";

function ok<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === "fulfilled" ? result.value : null;
}

/** El error del primer bloque que falló. */
function failure(...results: PromiseSettledResult<unknown>[]): unknown {
  return results.find((result): result is PromiseRejectedResult => result.status === "rejected")?.reason;
}

function DashboardTitle({ month, compareLabel }: { month: string; compareLabel?: string | null }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-[-0.015em] text-ink-950">Inicio</h1>
      <p className="mt-1 text-sm text-ink-600">
        {monthLabel(month)}
        {compareLabel && ` · variación: ${compareLabel}`}
      </p>
    </div>
  );
}
