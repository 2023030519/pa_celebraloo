import type { MonthlyReportRow } from "@/lib/data/admin";

/**
 * Columnas del reporte mensual (sección 10 del brief). Las mismas para la
 * tabla y el CSV, así lo que se ve y lo que se exporta nunca difieren.
 */
export const REPORT_COLUMNS: { key: keyof MonthlyReportRow; label: string; money?: boolean }[] = [
  { key: "month", label: "Mes" },
  { key: "ventas_brutas_cents", label: "Ventas", money: true },
  { key: "numero_ventas", label: "Número de ventas" },
  { key: "dinero_recibido_cents", label: "Dinero recibido", money: true },
  { key: "ingresos_netos_cents", label: "Ingresos netos", money: true },
  { key: "gastos_total_cents", label: "Gastos", money: true },
  { key: "resultado_operativo_cents", label: "Resultado operativo", money: true },
  { key: "clientes_nuevos", label: "Clientes nuevos" },
  { key: "clientes_de_pago_nuevos", label: "Clientes de pago nuevos" },
  { key: "eventos_creados", label: "Eventos creados" },
  { key: "plan_mas_comprado", label: "Plan más comprado" },
  { key: "complemento_mas_comprado", label: "Complemento más comprado" },
];

export const REPORT_NOTE =
  "Ingresos netos = ventas sin IVA − comisiones de Stripe. Resultado operativo = ventas sin IVA − comisiones − gastos (sin IVA).";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function reportRange(desde: string | undefined, meses: string | undefined, currentMonth: string) {
  const months = Math.min(36, Math.max(1, Number.isInteger(Number(meses)) && meses ? Number(meses) : 12));
  const [year, month] = currentMonth.split("-").map(Number);
  const startIndex = year * 12 + (month - 1) - (months - 1);
  const fallback = `${Math.floor(startIndex / 12)}-${String((startIndex % 12) + 1).padStart(2, "0")}`;
  return { from: desde && MONTH.test(desde) ? desde : fallback, months };
}

