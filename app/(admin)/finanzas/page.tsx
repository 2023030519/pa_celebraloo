import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth/require-admin";
import { getFinanceSummary, getSetAsideBreakdown, type FinanceSummary, type SetAsideRow } from "@/lib/data/admin";
import { formatMxn, monthLabel, monthOrCurrent, monthRange, shiftMonth, todayMx } from "@/lib/format";
import { PageTitle, Table, cn } from "@/components/ui";
import { DataError, MoneyTile } from "@/components/finance";

type Line = { key: keyof FinanceSummary; label: string; definition: string; strong?: boolean; negative?: boolean };

// Orden y definiciones de la sección 5 del brief. Los números salen tal cual
// de admin_finance_summary: aquí no se calcula nada.
const LINES: Line[] = [
  { key: "ventas_brutas_cents", label: "Ventas brutas", definition: "Total cobrado a clientes (por fecha de cobro)." },
  { key: "reembolsos_cents", label: "Reembolsos", definition: "Devuelto en el periodo (por fecha del reembolso).", negative: true },
  { key: "contracargos_cents", label: "Contracargos perdidos", definition: "Disputas que ganó el cliente (por fecha de cierre).", negative: true },
  { key: "dinero_recibido_cents", label: "Dinero recibido", definition: "Ventas brutas − reembolsos − contracargos.", strong: true },
  { key: "iva_cobrado_cents", label: "IVA cobrado", definition: "Con la tasa guardada en cada venta; los reembolsos restan su IVA. Se aparta." },
  { key: "ventas_sin_iva_cents", label: "Ventas sin IVA", definition: "Dinero recibido − IVA cobrado." },
  { key: "comisiones_stripe_cents", label: "Comisiones Stripe", definition: "Costo real de procesamiento (incluye el IVA de la comisión).", negative: true },
  { key: "gastos_subtotal_cents", label: "Otros gastos (sin IVA)", definition: "Gastos registrados en el periodo, sin retiros.", negative: true },
  { key: "resultado_operativo_cents", label: "Resultado operativo", definition: "Ventas sin IVA − comisiones − gastos.", strong: true },
  { key: "dinero_apartado_cents", label: "Reserva / apartados", definition: "IVA cobrado + apartados configurados." },
  { key: "gastos_total_cents", label: "Gastos pagados (con IVA)", definition: "Lo que salió de caja por gastos.", negative: true },
  { key: "retiros_cents", label: "Retiros", definition: "Dinero que salió para la dueña.", negative: true },
  {
    key: "dinero_disponible_cents",
    label: "Disponible",
    definition: "Recibido − comisiones − gastos pagados − retiros − apartado. No depende del saldo bancario.",
    strong: true,
  },
];

function describeRule(row: SetAsideRow): string {
  if (row.kind === "iva") return "IVA cobrado (siempre se aparta)";
  if (row.kind === "fixed") return `${formatMxn(row.value)} por mes`;
  const base = { ventas_sin_iva: "ventas sin IVA", dinero_recibido: "dinero recibido", resultado_operativo: "resultado operativo" }[row.base ?? ""] ?? row.base;
  return `${(row.value ?? 0) / 100}% de ${base}`;
}

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  await requireSuperAdmin();
  const month = monthOrCurrent((await searchParams).mes);
  const range = monthRange(month);
  const isCurrent = month === todayMx().slice(0, 7);

  let data;
  try {
    const [monthSummary, allTime, monthBreakdown, allBreakdown] = await Promise.all([
      getFinanceSummary(range.from, range.to),
      getFinanceSummary(null, null),
      getSetAsideBreakdown(range.from, range.to),
      getSetAsideBreakdown(null, null),
    ]);
    data = { monthSummary, allTime, monthBreakdown, allBreakdown };
  } catch (error) {
    return (
      <>
        <PageTitle title="Finanzas" />
        <DataError error={error} />
      </>
    );
  }
  const { monthSummary, allTime, monthBreakdown, allBreakdown } = data;
  const allByName = new Map(allBreakdown.map((row) => [row.name, row.amount_cents]));
  const navClass = "rounded-md px-3 py-1.5 font-semibold text-ink-800 hover:bg-surface";

  return (
    <>
      <PageTitle
        title="Finanzas"
        subtitle="Visión administrativa del dinero de Celebraloo. No sustituye la contabilidad fiscal."
        actions={
          <nav className="flex items-center gap-1 text-sm" aria-label="Mes">
            <Link href={`/finanzas?mes=${shiftMonth(month, -1)}`} className={navClass}>
              ←
            </Link>
            <span className="px-2 font-semibold">{monthLabel(month)}</span>
            {!isCurrent && (
              <Link href={`/finanzas?mes=${shiftMonth(month, 1)}`} className={navClass}>
                →
              </Link>
            )}
          </nav>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MoneyTile label={`Dinero recibido · ${monthLabel(month)}`} cents={monthSummary.dinero_recibido_cents} />
        <MoneyTile label="Dinero apartado (acumulado)" cents={allTime.dinero_apartado_cents} hint="IVA + apartados. No es para gastar." />
        <MoneyTile label="Dinero realmente disponible (acumulado)" cents={allTime.dinero_disponible_cents} emphasis />
      </div>

      {(monthSummary.ventas_sin_datos_financieros > 0 || allTime.ventas_sin_datos_financieros > 0) && (
        <p className="mb-4 rounded-lg border border-gold-600 bg-gold-100 px-3 py-2 text-xs text-ink-800">
          {allTime.ventas_sin_datos_financieros} ventas no tienen comisión de Stripe registrada; las comisiones y el disponible
          salen incompletos hasta correr el backfill.
        </p>
      )}

      <h2 className="mb-2 text-[15px] font-semibold">Resumen financiero</h2>
      <div className="mb-8">
        <Table head={["Indicador", monthLabel(month), "Acumulado", "Definición"]}>
          {LINES.map((line) => (
            <tr key={line.key} className={cn(line.strong && "bg-paper/70")}>
              <td className={cn("px-3 py-2.5", line.strong && "font-semibold")}>{line.label}</td>
              <td className={cn("px-3 py-2.5 text-right tabular-nums", line.strong && "font-semibold")}>
                {line.negative && Number(monthSummary[line.key]) > 0 ? "− " : ""}
                {formatMxn(Number(monthSummary[line.key]))}
              </td>
              <td className={cn("px-3 py-2.5 text-right tabular-nums text-ink-800", line.strong && "font-semibold")}>
                {line.negative && Number(allTime[line.key]) > 0 ? "− " : ""}
                {formatMxn(Number(allTime[line.key]))}
              </td>
              <td className="px-3 py-2.5 text-xs text-ink-600">{line.definition}</td>
            </tr>
          ))}
        </Table>
      </div>

      <h2 className="mb-1 text-[15px] font-semibold">Apartados</h2>
      <p className="mb-3 text-ink-600">
        Lo que se reserva y no cuenta como disponible. Los porcentajes y montos se ajustan en{" "}
        <Link href="/configuracion" className="font-semibold text-gold-800 hover:underline">
          Configuración
        </Link>
        .
      </p>
      <div>
        <Table head={["Apartado", "Regla", monthLabel(month), "Acumulado"]}>
          {monthBreakdown.map((row) => (
            <tr key={row.name}>
              <td className="px-3 py-2.5 font-medium">{row.name}</td>
              <td className="px-3 py-2.5 text-ink-600">{describeRule(row)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatMxn(row.amount_cents)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatMxn(allByName.get(row.name) ?? 0)}</td>
            </tr>
          ))}
          <tr className="bg-paper/70 font-semibold">
            <td className="px-3 py-2.5">Total apartado</td>
            <td className="px-3 py-2.5" />
            <td className="px-3 py-2.5 text-right tabular-nums">{formatMxn(monthSummary.dinero_apartado_cents)}</td>
            <td className="px-3 py-2.5 text-right tabular-nums">{formatMxn(allTime.dinero_apartado_cents)}</td>
          </tr>
        </Table>
        {monthBreakdown.length === 1 && (
          <p className="mt-3 text-xs text-ink-600">Solo el IVA está activo: las demás reglas de apartado están en 0 o inactivas.</p>
        )}
      </div>
    </>
  );
}
