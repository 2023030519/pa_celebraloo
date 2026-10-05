import { requireSuperAdmin } from "@/lib/auth/require-admin";
import { getMonthlyReport } from "@/lib/data/admin";
import { centsToInput, todayMx } from "@/lib/format";
import { REPORT_COLUMNS, reportRange } from "@/lib/reports";

/**
 * CSV del reporte mensual. Mismas columnas y misma RPC que la pantalla.
 * Montos en pesos con punto decimal; UTF-8 con BOM para que Excel respete
 * los acentos.
 */
export async function GET(request: Request) {
  await requireSuperAdmin();
  const url = new URL(request.url);
  const { from, months } = reportRange(url.searchParams.get("desde") ?? undefined, url.searchParams.get("meses") ?? undefined, todayMx().slice(0, 7));
  const rows = await getMonthlyReport(from, months);

  const escape = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const lines = [
    REPORT_COLUMNS.map((column) => escape(column.money ? `${column.label} (MXN)` : column.label)).join(","),
    ...rows.map((row) =>
      REPORT_COLUMNS.map((column) => {
        const value = row[column.key];
        if (value === null || value === undefined) return "";
        if (column.key === "month") return String(value).slice(0, 7);
        if (column.money) return centsToInput(value as number);
        return escape(String(value));
      }).join(",")
    ),
  ];

  return new Response(`﻿${lines.join("\n")}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="celebraloo-reporte-${from}-${months}m.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
