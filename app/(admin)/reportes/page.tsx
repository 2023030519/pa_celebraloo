import type { Metadata } from "next";
import { ArrowDownRight, ArrowUpRight, ChevronRight, Download, Info } from "lucide-react";
import { requirePermission } from "@/lib/auth/require-admin";
import { getMonthlyReport, getReportSummary, type MonthlyReportRow } from "@/lib/data/admin";
import { formatBps, formatDeltaBps, formatInt, formatMxn, monthLabel, todayMx } from "@/lib/format";
import { REPORT_COLUMNS, REPORT_NOTE, REPORT_PRESETS, rangeEndExclusive, reportRange, type ReportPreset } from "@/lib/reports";
import { HowCalculated, Nil, PageTitle, Segmented, Table, cn, ui, zeroClass } from "@/components/ui";
import { DataError } from "@/components/finance";
import { Field, fieldClass } from "@/components/filters";
import { Figure, FigureRow, FigureStrip } from "@/components/kpi";

export const metadata: Metadata = { title: "Reportes" };

type Search = { rango?: string; desde?: string; hasta?: string };
type Column = (typeof REPORT_COLUMNS)[number];

const isNumeric = (column: Column) => column.kind !== "text" && column.kind !== "month";
const isQuiet = (row: MonthlyReportRow) => row.transacciones === 0 && row.gastos_total_cents === 0 && row.clientes_nuevos === 0;
// En móvil la tabla deja lo que decide: mes, ventas, dinero recibido y resultado.
const MOBILE_KEEP = new Set<Column["key"]>(["month", "ventas_brutas_cents", "dinero_recibido_cents", "resultado_operativo_cents"]);
const MOBILE_HIDE = REPORT_COLUMNS.flatMap((column, index) => (MOBILE_KEEP.has(column.key) ? [] : [index]));
const shortMonth = new Intl.DateTimeFormat("es-MX", { month: "short", year: "numeric", timeZone: "UTC" });

function Cell({ row, column }: { row: MonthlyReportRow; column: Column }) {
  const value = row[column.key];
  if (column.kind === "month") {
    const month = String(value).slice(0, 7);
    return (
      <>
        <span className="max-sm:hidden">{monthLabel(month)}</span>
        <span className="sm:hidden">{shortMonth.format(new Date(`${month}-01T12:00:00Z`))}</span>
      </>
    );
  }
  if (value === null || value === undefined) return <Nil />;
  // R21: el cero va atenuado en un span propio, así gana también en los meses sin movimiento.
  if (column.kind === "money") return <span className={zeroClass(value as number)}>{formatMxn(value as number)}</span>;
  if (column.kind === "int") return <span className={zeroClass(value as number)}>{formatInt(value as number)}</span>;
  if (column.kind === "percent") return <span className={zeroClass(value as number)}>{formatBps(value as number)}</span>;
  if (column.kind === "delta") {
    const delta = value as number;
    if (delta === 0) return <span className="text-ink-400">0 %</span>;
    const Icon = delta > 0 ? ArrowUpRight : ArrowDownRight;
    return (
      <span className={cn("inline-flex items-center gap-0.5 font-medium", delta > 0 ? "text-ok-700" : "text-danger-700")}>
        <Icon size={14} aria-hidden="true" />
        {formatDeltaBps(delta)}
      </span>
    );
  }
  return <>{String(value)}</>;
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePermission("reportes.read");
  const params = await searchParams;
  const range = reportRange(params, todayMx().slice(0, 7));
  const query = (preset: ReportPreset) => (preset === "personalizado" ? `?rango=personalizado&desde=${range.from}&hasta=${range.to}` : `?rango=${preset}`);
  const csvHref = `/reportes/csv?rango=${range.preset}&desde=${range.from}&hasta=${range.to}`;

  let rows: MonthlyReportRow[];
  let summary;
  try {
    [rows, summary] = await Promise.all([
      getMonthlyReport(range.from, range.months),
      getReportSummary(`${range.from}-01`, rangeEndExclusive(range.to)),
    ]);
  } catch (error) {
    return (
      <>
        <PageTitle title="Reportes" />
        <DataError error={error} />
      </>
    );
  }
  const label = `${monthLabel(range.from)} – ${monthLabel(range.to)}`;
  const empty = rows.every(isQuiet);
  const monthly = (
    // Table solo trae clases de ocultar hasta la columna 10; las de la 11 en adelante (todas fuera de MOBILE_KEEP) se ocultan aquí.
    // px-2 en móvil: con las cuatro columnas a px-3 la última se salía de la tarjeta a 390 px.
    <div className="max-sm:[&_tr>*:nth-child(n+11)]:hidden max-sm:[&_td]:px-2 max-sm:[&_th]:px-2">
    <Table
      title={empty ? undefined : "Mes a mes"}
      caption="Mes a mes"
      aside={
        <p className="text-[13px] text-ink-600">
          {formatInt(range.months)} {range.months === 1 ? "mes" : "meses"} · el CSV descarga esta tabla tal cual.
        </p>
      }
      mobileHide={MOBILE_HIDE}
      head={REPORT_COLUMNS.map((column) => (isNumeric(column) ? <span key={column.key} className="block text-right">{column.label}</span> : column.label))}
    >
      {[...rows].reverse().map((row) => (
        // Meses sin movimiento atenuados: la vista va directo a los que sí tienen.
        <tr key={row.month} className={cn(isQuiet(row) && "[&>td]:text-ink-600")}>
          {REPORT_COLUMNS.map((column) => (
            <td
              key={column.key}
              className={cn(
                "px-3 py-2.5 whitespace-nowrap",
                isNumeric(column) ? "text-right tabular-nums" : column.kind === "month" ? "font-medium text-ink-950" : "text-ink-800"
              )}
            >
              <Cell row={row} column={column} />
            </td>
          ))}
        </tr>
      ))}
    </Table>
    </div>
  );

  return (
    <>
      <PageTitle
        title="Reportes"
        subtitle={`Histórico mensual · ${label}`}
        primaryAction={
          <a href={csvHref} download className={ui.buttonPrimary}>
            <Download size={16} aria-hidden="true" /> Exportar CSV
          </a>
        }
      />

      {/* 1. Consultar: el periodo define la tabla, y la tabla es lo que descarga el CSV. */}
      <div className="mb-4 flex flex-wrap items-end gap-x-4 gap-y-3">
        <Segmented
          wrap
          label="Periodo"
          options={Object.entries(REPORT_PRESETS) as [ReportPreset, string][]}
          current={range.preset}
          href={(preset) => `/reportes${query(preset)}`}
        />
        {range.preset === "personalizado" && (
          <form className="flex flex-wrap items-end gap-2 max-sm:grid max-sm:w-full max-sm:grid-cols-2">
            {/* En móvil el rango va a todo el ancho y Aplicar debajo, al pulgar. */}
            <input type="hidden" name="rango" value="personalizado" />
            <Field label="Desde">
              <input type="month" lang="es-MX" name="desde" defaultValue={range.from} className={fieldClass} />
            </Field>
            <Field label="Hasta">
              <input type="month" lang="es-MX" name="hasta" defaultValue={range.to} className={fieldClass} />
            </Field>
            <button className={cn(ui.buttonSecondarySm, "max-sm:col-span-2")}>Aplicar</button>
            <span className="self-center text-xs text-ink-600 max-sm:col-span-2">Máximo 36 meses.</span>
          </form>
        )}
      </div>

      {range.notice && (
        <p role="status" className="mb-4 flex items-start gap-2 rounded-md border border-info-300 bg-info-100 px-3 py-2 text-[13px] text-info-700">
          <Info size={16} className="mt-px shrink-0" aria-hidden="true" />
          {range.notice}
        </p>
      )}

      <h2 className="sr-only">Resumen del periodo</h2>
      <div className="mb-6">
        <FigureStrip>
          <FigureRow cols={4} label="Resumen del periodo">
            <Figure label="Dinero recibido" value={formatMxn(summary.ingresos_cents)} hint={`${label}. IVA incluido.`} />
            <Figure label="Resultado operativo" value={formatMxn(summary.resultado_operativo_cents)} hint="Ingresos netos − gastos (sin IVA)." />
            <Figure label="Nuevos de pago" value={formatInt(summary.clientes_de_pago_nuevos)} hint="Primera compra en el periodo." />
            <Figure
              label="Ticket promedio"
              value={summary.ticket_promedio_cents === null ? <Nil /> : formatMxn(summary.ticket_promedio_cents)}
              hint={
                summary.transacciones === 0
                  ? "Aún no hay ventas en este periodo."
                  : `${formatInt(summary.transacciones)} transacciones${summary.ventas_con_descuento ? ` · ${formatInt(summary.ventas_con_descuento)} con descuento (−${formatMxn(summary.descuentos_cents)})` : ""}`
              }
            />
          </FigureRow>
        </FigureStrip>
      </div>

      {/* 2. Exportar: la tabla es la vista previa exacta del CSV (mismas columnas, mismo rango). */}
      {empty ? (
        <section aria-labelledby="monthly">
          <h2 id="monthly" className="text-base font-semibold text-ink-950">
            Mes a mes
          </h2>
          <p className="mt-1 text-sm text-ink-600">
            Sin movimiento de {monthLabel(range.from)} a {monthLabel(range.to)}.
          </p>
          <details className="group mt-2">
            <summary className="flex w-fit cursor-pointer list-none items-center gap-1 rounded-sm py-0.5 text-xs max-md:min-h-11 font-medium text-ink-600 transition-colors duration-[var(--dur-fast)] hover:text-ink-950 [&::-webkit-details-marker]:hidden">
              Ver meses
              <ChevronRight size={14} aria-hidden="true" className="transition-transform duration-[var(--dur-fast)] group-open:rotate-90 motion-reduce:transition-none" />
            </summary>
            <div className="mt-2">{monthly}</div>
          </details>
        </section>
      ) : (
        monthly
      )}
      <HowCalculated>
        <p>{REPORT_NOTE}</p>
        <p>Nuevos de pago: clientes de pago nuevos, con su primera compra en el periodo.</p>
      </HowCalculated>
    </>
  );
}
