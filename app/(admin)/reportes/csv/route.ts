import { requirePermission } from "@/lib/auth/require-admin";
import { getMonthlyReport } from "@/lib/data/admin";
import { centsToInput, todayMx } from "@/lib/format";
import { REPORT_COLUMNS, reportRange } from "@/lib/reports";

/**
 * CSV del reporte mensual. Mismas columnas, mismo rango y misma RPC que la
 * pantalla. Montos en pesos con punto decimal; porcentajes como número
 * (18.5 = 18.5 %); UTF-8 con BOM para que Excel respete los acentos.
 */
export async function GET(request: Request) {
  await requirePermission("reportes.read");
  const url = new URL(request.url);
  const range = reportRange(
    {
      rango: url.searchParams.get("rango") ?? undefined,
      desde: url.searchParams.get("desde") ?? undefined,
      hasta: url.searchParams.get("hasta") ?? undefined,
    },
    todayMx().slice(0, 7)
  );
  const rows = await getMonthlyReport(range.from, range.months);

  const escape = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const header = (column: (typeof REPORT_COLUMNS)[number]) =>
    column.kind === "money" ? `${column.label} (MXN)` : column.kind === "percent" || column.kind === "delta" ? `${column.label} (%)` : column.label;
  const lines = [
    REPORT_COLUMNS.map((column) => escape(header(column))).join(","),
    ...rows.map((row) =>
      REPORT_COLUMNS.map((column) => {
        const value = row[column.key];
        if (value === null || value === undefined) return "";
        if (column.kind === "month") return String(value).slice(0, 7);
        if (column.kind === "money") return centsToInput(value as number);
        if (column.kind === "percent" || column.kind === "delta") return ((value as number) / 100).toFixed(2);
        return escape(String(value));
      }).join(",")
    ),
  ];

  return new Response(`﻿${lines.join("\n")}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="celebraloo-reporte-${range.from}-a-${range.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
