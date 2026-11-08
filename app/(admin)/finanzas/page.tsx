import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth/require-admin";
import { getFinanceSummary, getSetAsideBreakdown, type FinanceSummary, type SetAsideRow } from "@/lib/data/admin";
import { formatMxn, monthLabel, monthOrCurrent, monthRange, shiftMonth, todayMx } from "@/lib/format";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { HowCalculated, PageTitle, Table, cn, ui, zeroClass } from "@/components/ui";
import { DataError } from "@/components/finance";
import { Figure, FigureRow, FigureStrip } from "@/components/kpi";

export const metadata: Metadata = { title: "Finanzas" };

type Line = { key: keyof FinanceSummary; label: string; definition: string; strong?: boolean; negative?: boolean };

// Orden y definiciones de la sección 5 del brief. Los números salen tal cual
// de admin_finance_summary: aquí no se calcula nada.
const LINES: Line[] = [
  { key: "ventas_brutas_cents", label: "Ventas brutas (con IVA)", definition: "Total cobrado a clientes (por fecha de cobro)." },
  { key: "reembolsos_cents", label: "Reembolsos", definition: "Devuelto en el periodo (por fecha del reembolso).", negative: true },
  { key: "contracargos_cents", label: "Contracargos perdidos", definition: "Disputas que ganó el cliente (por fecha de cierre).", negative: true },
  { key: "dinero_recibido_cents", label: "Dinero recibido (con IVA)", definition: "Ventas brutas − reembolsos − contracargos.", strong: true },
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
  await requirePermission("finanzas.read");
  const current = todayMx().slice(0, 7);
  // Un mes futuro (?mes=2027-05) no tiene movimientos: se queda en el actual.
  const requested = monthOrCurrent((await searchParams).mes);
  const month = requested > current ? current : requested;
  const range = monthRange(month);
  const isCurrent = month === current;

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
  const navClass = "inline-flex size-9 max-md:size-11 items-center justify-center rounded-md text-ink-800 transition-colors duration-[var(--dur-fast)] hover:bg-surface-2 hover:text-ink-950";
  const right = (text: string) => <span className="block text-right">{text}</span>;
  // En móvil el mes completo ensancha la columna y empuja "Acumulado" fuera de la pantalla.
  const monthHead = (
    <span key="mes" className="block text-right">
      <span className="sm:hidden">Mes</span>
      <span className="max-sm:hidden">{monthLabel(month)}</span>
    </span>
  );

  return (
    <>
      <PageTitle
        title="Finanzas"
        subtitle="Visión administrativa del dinero. No sustituye la contabilidad fiscal."
      />

      <nav className="mb-4 inline-flex items-center rounded-md border border-ink-150 bg-surface text-sm" aria-label="Mes">
        <Link href={`/finanzas?mes=${shiftMonth(month, -1)}`} className={navClass} aria-label="Mes anterior">
          <ChevronLeft size={16} aria-hidden="true" />
        </Link>
        <span className="min-w-36 px-2 text-center font-medium text-ink-950">{monthLabel(month)}</span>
        {isCurrent ? (
          <span className={cn(navClass, "text-ink-400 hover:bg-transparent hover:text-ink-400")} aria-hidden="true">
            <ChevronRight size={16} />
          </span>
        ) : (
          <Link href={`/finanzas?mes=${shiftMonth(month, 1)}`} className={navClass} aria-label="Mes siguiente">
            <ChevronRight size={16} aria-hidden="true" />
          </Link>
        )}
      </nav>

      <h2 className="sr-only">Cifras principales</h2>
      <div className="mb-6">
        <FigureStrip>
          <FigureRow cols={3} label="Cifras principales">
            {/* R20: etiquetas cortas para caber en una línea a 390 px; el periodo va en el pie. */}
            <Figure label="Dinero recibido" value={formatMxn(monthSummary.dinero_recibido_cents)} hint={`${monthLabel(month)}. IVA incluido.`} />
            <Figure label="Dinero apartado" value={formatMxn(allTime.dinero_apartado_cents)} hint="Acumulado. IVA + apartados; no es para gastar." />
            <Figure
              label="Disponible"
              value={formatMxn(allTime.dinero_disponible_cents)}
              hint="Acumulado y calculado; no es el saldo del banco."
              emphasis
            />
          </FigureRow>
        </FigureStrip>
      </div>

      {(monthSummary.ventas_sin_datos_financieros > 0 || allTime.ventas_sin_datos_financieros > 0) && (
        <p role="note" className="mb-6 flex items-start gap-2 rounded-lg border border-warn-300 bg-warn-100 px-4 py-3 text-[13px] text-warn-700">
          <AlertTriangle size={16} aria-hidden="true" className="mt-px shrink-0" />
          {allTime.ventas_sin_datos_financieros} ventas no tienen el desglose de Stripe registrado: las comisiones y el disponible
          salen incompletos, y su IVA (y con él las ventas sin IVA y el resultado) puede ser una estimación con la tasa vigente hasta
          correr el backfill.
        </p>
      )}

      <section aria-labelledby="resumen" className="mb-8">
        <h2 id="resumen" className="mb-3 text-base font-semibold text-ink-950">
          Resumen financiero
        </h2>
        <Table head={["Indicador", monthHead, right("Acumulado"), "Definición"]} mobileHide={[3]}>
          {LINES.map((line) => (
            <tr key={line.key} className={cn(line.strong && "bg-surface-2/60")}>
              <td className={cn("px-3 py-2.5 whitespace-nowrap", line.strong ? "font-semibold text-ink-950" : "text-ink-800")}>{line.label}</td>
              <td
                className={cn(
                  "px-3 py-2.5 text-right whitespace-nowrap tabular-nums",
                  line.strong && "font-semibold",
                  zeroClass(Number(monthSummary[line.key]))
                )}
              >
                {line.negative && Number(monthSummary[line.key]) > 0 ? "− " : ""}
                {formatMxn(Number(monthSummary[line.key]))}
              </td>
              <td
                className={cn(
                  "px-3 py-2.5 text-right whitespace-nowrap tabular-nums",
                  zeroClass(Number(allTime[line.key]), line.strong ? "text-ink-950" : "text-ink-800"),
                  line.strong && "font-semibold"
                )}
              >
                {line.negative && Number(allTime[line.key]) > 0 ? "− " : ""}
                {formatMxn(Number(allTime[line.key]))}
              </td>
              <td className="min-w-64 px-3 py-2.5 text-xs text-ink-600">{line.definition}</td>
            </tr>
          ))}
        </Table>
        <HowCalculated>
          <p>Se lee de arriba abajo: cada renglón en negritas resulta de los de arriba.</p>
          {/* En móvil la columna Definición se oculta: aquí siguen a la mano. */}
          <dl className="flex flex-col gap-1 sm:hidden">
            {LINES.map((line) => (
              <div key={line.key}>
                <dt className="inline font-medium text-ink-800">{line.label}: </dt>
                <dd className="inline">{line.definition}</dd>
              </div>
            ))}
          </dl>
        </HowCalculated>
      </section>

      <section aria-labelledby="apartados">
        <div className="mb-3">
          <h2 id="apartados" className="text-base font-semibold text-ink-950">
            Apartados
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-600">
            Lo que se reserva y no cuenta como disponible. Los porcentajes y montos se ajustan en{" "}
            <Link href="/configuracion" className={ui.link}>
              Configuración
            </Link>
            .
          </p>
        </div>
        <Table head={["Apartado", "Regla", monthHead, right("Acumulado")]} mobileHide={[1]}>
          {monthBreakdown.map((row) => (
            <tr key={row.name}>
              <td className="px-3 py-2.5 font-medium">{row.name}</td>
              <td className="px-3 py-2.5 text-ink-600">{describeRule(row)}</td>
              <td className={cn("px-3 py-2.5 text-right tabular-nums", zeroClass(Number(row.amount_cents)))}>{formatMxn(row.amount_cents)}</td>
              <td className={cn("px-3 py-2.5 text-right tabular-nums", zeroClass(Number(allByName.get(row.name) ?? 0)))}>
                {formatMxn(allByName.get(row.name) ?? 0)}
              </td>
            </tr>
          ))}
          <tr className="bg-surface-2/60 font-semibold text-ink-950">
            <td className="px-3 py-2.5">Total apartado</td>
            <td className="px-3 py-2.5" />
            <td className={cn("px-3 py-2.5 text-right tabular-nums", zeroClass(Number(monthSummary.dinero_apartado_cents)))}>{formatMxn(monthSummary.dinero_apartado_cents)}</td>
            <td className={cn("px-3 py-2.5 text-right tabular-nums", zeroClass(Number(allTime.dinero_apartado_cents)))}>{formatMxn(allTime.dinero_apartado_cents)}</td>
          </tr>
        </Table>
        {monthBreakdown.length === 1 && (
          <p className="mt-3 text-xs text-ink-600">Solo el IVA está activo: las demás reglas de apartado están en 0 o inactivas.</p>
        )}
      </section>
    </>
  );
}
