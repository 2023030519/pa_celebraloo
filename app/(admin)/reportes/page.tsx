import Link from "next/link";
import { Download } from "lucide-react";
import { requirePermission } from "@/lib/auth/require-admin";
import { getMonthlyReport, getReportSummary, type MonthlyReportRow } from "@/lib/data/admin";
import { formatBps, formatDeltaBps, formatInt, formatMxn, monthLabel, todayMx } from "@/lib/format";
import { REPORT_COLUMNS, REPORT_NOTE, REPORT_PRESETS, rangeEndExclusive, reportRange, type ReportPreset } from "@/lib/reports";
import { PageTitle, Table, cn } from "@/components/ui";
import { DataError } from "@/components/finance";
import { fieldClass } from "@/components/filters";
import { KpiTile } from "@/components/kpi";

type Search = { rango?: string; desde?: string; hasta?: string };

function Cell({ row, column }: { row: MonthlyReportRow; column: (typeof REPORT_COLUMNS)[number] }) {
  const value = row[column.key];
  if (column.kind === "month") return <>{monthLabel(String(value).slice(0, 7))}</>;
  if (value === null || value === undefined) return <span className="text-ink-600">—</span>;
  if (column.kind === "money") return <>{formatMxn(value as number)}</>;
  if (column.kind === "int") return <>{formatInt(value as number)}</>;
  if (column.kind === "percent") return <>{formatBps(value as number)}</>;
  if (column.kind === "delta") {
    const delta = value as number;
    return (
      <span className={delta > 0 ? "text-ok-700" : delta < 0 ? "text-danger-700" : "text-ink-600"}>
        {delta > 0 ? "▲ " : delta < 0 ? "▼ " : ""}
        {delta === 0 ? "0 %" : formatDeltaBps(delta)}
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
  const empty = rows.every((row) => row.transacciones === 0 && row.gastos_total_cents === 0 && row.clientes_nuevos === 0);

  return (
    <>
      <PageTitle
        title="Reportes"
        subtitle={`Histórico mensual · ${label}`}
        actions={
          <Link
            href={csvHref}
            prefetch={false}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-ink-950 px-4 font-semibold text-surface hover:bg-ink-800"
          >
            <Download size={16} aria-hidden="true" /> Exportar CSV
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div role="group" aria-label="Periodo" className="inline-flex rounded-md border border-ink-250 bg-surface p-0.5">
          {(Object.keys(REPORT_PRESETS) as ReportPreset[]).map((preset) => (
            <Link
              key={preset}
              href={`/reportes${query(preset)}`}
              aria-current={preset === range.preset ? "true" : undefined}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
                preset === range.preset ? "bg-ink-950 text-surface" : "text-ink-800 hover:bg-paper"
              )}
            >
              {REPORT_PRESETS[preset]}
            </Link>
          ))}
        </div>
        {range.preset === "personalizado" && (
          <form className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="rango" value="personalizado" />
            <label className="flex flex-col gap-1 text-xs font-semibold text-ink-800">
              Desde
              <input type="month" name="desde" defaultValue={range.from} className={fieldClass} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-ink-800">
              Hasta
              <input type="month" name="hasta" defaultValue={range.to} className={fieldClass} />
            </label>
            <button className="h-9 rounded-md bg-ink-950 px-4 font-semibold text-surface hover:bg-ink-800">Aplicar</button>
            <span className="self-center text-xs text-ink-600">Máximo 36 meses.</span>
          </form>
        )}
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Ingresos recibidos" value={formatMxn(summary.ingresos_cents)} hint={label} />
        <KpiTile label="Resultado operativo" value={formatMxn(summary.resultado_operativo_cents)} hint="Ingresos netos − gastos (sin IVA)." />
        <KpiTile label="Clientes de pago nuevos" value={formatInt(summary.clientes_de_pago_nuevos)} hint="Primera compra en el periodo." />
        <KpiTile
          label="Ticket promedio"
          value={summary.ticket_promedio_cents === null ? "—" : formatMxn(summary.ticket_promedio_cents)}
          hint={
            summary.transacciones === 0
              ? "Aún no hay ventas en este periodo."
              : `${formatInt(summary.transacciones)} transacciones${summary.ventas_con_descuento ? ` · ${formatInt(summary.ventas_con_descuento)} con descuento (−${formatMxn(summary.descuentos_cents)})` : ""}`
          }
        />
      </div>

      {empty && <p className="mb-3 text-ink-600">Aún no hay ventas, gastos ni registros en este periodo.</p>}

      <Table head={REPORT_COLUMNS.map((column) => column.label)}>
        {[...rows].reverse().map((row) => (
          <tr key={row.month} className="hover:bg-paper">
            {REPORT_COLUMNS.map((column) => (
              <td
                key={column.key}
                className={cn(
                  "px-3 py-2.5 whitespace-nowrap",
                  column.kind !== "text" && column.kind !== "month" && "text-right tabular-nums",
                  column.kind === "month" && "font-medium"
                )}
              >
                <Cell row={row} column={column} />
              </td>
            ))}
          </tr>
        ))}
      </Table>
      <p className="mt-2 text-xs text-ink-600">{REPORT_NOTE}</p>
    </>
  );
}
