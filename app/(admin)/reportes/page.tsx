import Link from "next/link";
import { Download } from "lucide-react";
import { requirePermission } from "@/lib/auth/require-admin";
import { getMonthlyReport } from "@/lib/data/admin";
import { formatInt, formatMxn, monthLabel, todayMx } from "@/lib/format";
import { REPORT_COLUMNS, REPORT_NOTE, reportRange } from "@/lib/reports";
import { PageTitle, Table } from "@/components/ui";
import { DataError } from "@/components/finance";
import { Field, FilterBar, fieldClass } from "@/components/filters";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ desde?: string; meses?: string }> }) {
  await requirePermission("reportes.read");
  const params = await searchParams;
  const { from, months } = reportRange(params.desde, params.meses, todayMx().slice(0, 7));

  let rows;
  try {
    rows = await getMonthlyReport(from, months);
  } catch (error) {
    return (
      <>
        <PageTitle title="Reportes" />
        <DataError error={error} />
      </>
    );
  }

  return (
    <>
      <PageTitle
        title="Reportes"
        subtitle={REPORT_NOTE}
        actions={
          <Link
            href={`/reportes/csv?desde=${from}&meses=${months}`}
            prefetch={false}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-ink-950 px-4 font-semibold text-surface hover:bg-ink-800"
          >
            <Download size={16} aria-hidden="true" /> Exportar CSV
          </Link>
        }
      />
      <FilterBar resetHref="/reportes">
        <Field label="Desde (mes)">
          <input type="month" name="desde" defaultValue={from} className={fieldClass} />
        </Field>
        <Field label="Meses">
          <select name="meses" defaultValue={String(months)} className={fieldClass}>
            {[3, 6, 12, 24, 36].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </Field>
      </FilterBar>
      <Table head={REPORT_COLUMNS.map((column) => column.label)}>
        {[...rows].reverse().map((row) => (
          <tr key={row.month} className="hover:bg-paper">
            {REPORT_COLUMNS.map((column) => {
              const value = row[column.key];
              return (
                <td
                  key={column.key}
                  className={`px-3 py-2.5 whitespace-nowrap ${typeof value === "number" ? "text-right tabular-nums" : ""} ${column.key === "month" ? "font-medium" : ""}`}
                >
                  {column.key === "month"
                    ? monthLabel(String(value).slice(0, 7))
                    : column.money
                      ? formatMxn(value as number)
                      : typeof value === "number"
                        ? formatInt(value)
                        : (value ?? "—")}
                </td>
              );
            })}
          </tr>
        ))}
      </Table>
    </>
  );
}
