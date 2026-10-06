import type { MonthlyReportRow } from "@/lib/data/admin";

type ColumnKind = "month" | "money" | "int" | "percent" | "delta" | "text";

/**
 * Columnas del reporte mensual. Las mismas para la tabla y el CSV, así lo
 * que se ve y lo que se exporta nunca difieren.
 */
export const REPORT_COLUMNS: { key: keyof MonthlyReportRow; label: string; kind: ColumnKind }[] = [
  { key: "month", label: "Mes", kind: "month" },
  { key: "ventas_brutas_cents", label: "Ventas brutas", kind: "money" },
  { key: "transacciones", label: "Transacciones", kind: "int" },
  { key: "ticket_promedio_cents", label: "Ticket promedio", kind: "money" },
  { key: "dinero_recibido_cents", label: "Dinero recibido", kind: "money" },
  { key: "variacion_ingresos_bps", label: "Variación vs mes anterior", kind: "delta" },
  { key: "ingresos_netos_cents", label: "Ingresos netos", kind: "money" },
  { key: "gastos_total_cents", label: "Gastos", kind: "money" },
  { key: "resultado_operativo_cents", label: "Resultado operativo", kind: "money" },
  { key: "clientes_nuevos", label: "Clientes nuevos", kind: "int" },
  { key: "clientes_de_pago_nuevos", label: "Clientes de pago nuevos", kind: "int" },
  { key: "conversion_bps", label: "Conversión a pago", kind: "percent" },
  { key: "eventos_creados", label: "Eventos creados", kind: "int" },
  { key: "ventas_con_descuento", label: "Ventas con descuento", kind: "int" },
  { key: "descuentos_cents", label: "Descuentos", kind: "money" },
  { key: "plan_mas_comprado", label: "Plan más comprado", kind: "text" },
  { key: "complemento_mas_comprado", label: "Complemento más comprado", kind: "text" },
];

export const REPORT_NOTE =
  "Ventas brutas = lo cobrado (ya con descuentos). Dinero recibido = ventas − reembolsos − contracargos. Ingresos netos = sin IVA − comisiones de Stripe. Resultado operativo = ingresos netos − gastos (sin IVA). Variación: contra el mes anterior completo; el mes en curso, contra los mismos días.";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export const REPORT_PRESETS = {
  "6m": "Últimos 6 meses",
  "12m": "Últimos 12 meses",
  anio: "Este año",
  personalizado: "Personalizado",
} as const;
export type ReportPreset = keyof typeof REPORT_PRESETS;

const monthIndex = (month: string) => {
  const [year, mon] = month.split("-").map(Number);
  return year * 12 + (mon - 1);
};
const fromIndex = (index: number) => `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;

/**
 * Rango del reporte en meses completos (hasta 36). Personalizado usa
 * desde/hasta (YYYY-MM); si faltan o están al revés, cae en 12 meses.
 */
export function reportRange(
  params: { rango?: string; desde?: string; hasta?: string },
  currentMonth: string
): { preset: ReportPreset; from: string; to: string; months: number } {
  const current = monthIndex(currentMonth);
  const preset: ReportPreset = params.rango && params.rango in REPORT_PRESETS ? (params.rango as ReportPreset) : "12m";

  if (preset === "personalizado" && params.desde && MONTH.test(params.desde)) {
    const end = params.hasta && MONTH.test(params.hasta) ? Math.min(monthIndex(params.hasta), current) : current;
    const start = Math.max(monthIndex(params.desde), end - 35);
    if (start <= end) return { preset, from: fromIndex(start), to: fromIndex(end), months: end - start + 1 };
  }
  if (preset === "6m") return { preset, from: fromIndex(current - 5), to: currentMonth, months: 6 };
  if (preset === "anio") {
    const january = current - (current % 12);
    return { preset, from: fromIndex(january), to: currentMonth, months: current - january + 1 };
  }
  return { preset: preset === "personalizado" ? "12m" : preset, from: fromIndex(current - 11), to: currentMonth, months: 12 };
}

/** Primer día después del rango (para las tarjetas), YYYY-MM-DD. */
export function rangeEndExclusive(toMonth: string): string {
  return `${fromIndex(monthIndex(toMonth) + 1)}-01`;
}
