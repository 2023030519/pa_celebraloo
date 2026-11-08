import type { MonthlyReportRow } from "@/lib/data/admin";
// Con extensión para que `node lib/reports.check.mjs` lo resuelva.
import { addDays } from "./format.ts";

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
  { key: "gastos_subtotal_cents", label: "Gastos (sin IVA)", kind: "money" },
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
  "Ventas brutas = lo cobrado (ya con descuentos). Ticket promedio = ventas brutas ÷ transacciones. Dinero recibido = ventas − reembolsos − contracargos. Ingresos netos = sin IVA − comisiones de Stripe. Resultado operativo = ingresos netos − gastos (sin IVA). Variación: contra el mes anterior completo; el mes en curso, contra los mismos días.";

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
 * desde/hasta (YYYY-MM). Un rango que no se puede mostrar tal cual se corrige
 * y notice dice qué se cambió, para que la pantalla lo avise.
 */
export function reportRange(
  params: { rango?: string; desde?: string; hasta?: string },
  currentMonth: string
): { preset: ReportPreset; from: string; to: string; months: number; notice: string | null } {
  const current = monthIndex(currentMonth);
  const preset: ReportPreset = params.rango && params.rango in REPORT_PRESETS ? (params.rango as ReportPreset) : "12m";

  if (preset === "personalizado" && params.desde && MONTH.test(params.desde)) {
    const notices: string[] = [];
    let start = monthIndex(params.desde);
    let end = params.hasta && MONTH.test(params.hasta) ? monthIndex(params.hasta) : current;
    if (start > end) {
      [start, end] = [end, start];
      notices.push("«Desde» era posterior a «Hasta»: se invirtieron.");
    }
    if (end > current) {
      end = current;
      start = Math.min(start, current);
      notices.push("El rango no puede pasar del mes actual: termina en este mes.");
    }
    if (end - start > 35) {
      start = end - 35;
      notices.push("El máximo es 36 meses: se muestran los últimos 36 del rango.");
    }
    return { preset, from: fromIndex(start), to: fromIndex(end), months: end - start + 1, notice: notices.join(" ") || null };
  }
  const notice = preset === "personalizado" ? "Falta un mes de inicio válido: se muestran los últimos 12 meses." : null;
  if (preset === "6m") return { preset, from: fromIndex(current - 5), to: currentMonth, months: 6, notice };
  if (preset === "anio") {
    const january = current - (current % 12);
    return { preset, from: fromIndex(january), to: currentMonth, months: current - january + 1, notice };
  }
  return { preset: "12m", from: fromIndex(current - 11), to: currentMonth, months: 12, notice };
}

export const METRICS_PRESETS = {
  "30d": "Últimos 30 días",
  "90d": "Últimos 90 días",
  anio: "Este año",
  "12m": "Últimos 12 meses",
  personalizado: "Personalizado",
} as const;
export type MetricsPreset = keyof typeof METRICS_PRESETS;

// admin_metrics rechaza más de 1100 días; 3 años caben.
const MAX_METRICS_DAYS = 1095;

/** YYYY-MM-DD que existe en el calendario (2026-02-30 no), o null. */
function isoDay(raw: string | undefined): string | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const time = Date.parse(`${raw}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().startsWith(raw) ? raw : null;
}

/**
 * [desde, hasta) de Métricas en días de CDMX. Personalizado: desde/hasta
 * inclusivos, hasta hoy y hasta 3 años; lo que se corrige va en notice.
 */
export function metricsPeriod(
  params: { periodo?: string; desde?: string; hasta?: string },
  today: string
): { preset: MetricsPreset; from: string; to: string; notice: string | null } {
  const preset: MetricsPreset = params.periodo && params.periodo in METRICS_PRESETS ? (params.periodo as MetricsPreset) : "30d";
  const to = addDays(today, 1);
  const desde = isoDay(params.desde);

  if (preset === "personalizado" && desde) {
    const notices: string[] = [];
    let start = desde;
    let end = isoDay(params.hasta) ?? today;
    if (start > end) {
      [start, end] = [end, start];
      notices.push("«Desde» era posterior a «Hasta»: se invirtieron.");
    }
    if (end > today) {
      end = today;
      if (start > end) start = end;
      notices.push("El rango no puede pasar de hoy: termina hoy.");
    }
    if (start < addDays(end, 1 - MAX_METRICS_DAYS)) {
      start = addDays(end, 1 - MAX_METRICS_DAYS);
      notices.push("El máximo es 3 años: se muestran los últimos 3 años del rango.");
    }
    return { preset, from: start, to: addDays(end, 1), notice: notices.join(" ") || null };
  }
  const notice = preset === "personalizado" ? "Falta una fecha de inicio válida: se muestran los últimos 30 días." : null;
  if (preset === "90d") return { preset, from: addDays(today, -89), to, notice };
  if (preset === "anio") return { preset, from: `${today.slice(0, 4)}-01-01`, to, notice };
  if (preset === "12m") return { preset, from: addDays(today, -364), to, notice };
  return { preset: "30d", from: addDays(today, -29), to, notice };
}

/** Primer día después del rango (para las tarjetas), YYYY-MM-DD. */
export function rangeEndExclusive(toMonth: string): string {
  return `${fromIndex(monthIndex(toMonth) + 1)}-01`;
}
