import "server-only";
import Link from "next/link";
import { Card, Stat } from "@/components/ui";
import { AttentionList, DataError, MoneyTile, SalesTable } from "@/components/finance";
import { SalesByDayChart } from "@/components/sales-by-day-chart";
import {
  getAttentionItems,
  getFinanceSummary,
  getOperationalKpis,
  getSalesByDay,
  getSalesByProduct,
  listSales,
} from "@/lib/data/admin";
import { formatInt, formatMxn, monthLabel, monthRange, shiftMonth, todayMx } from "@/lib/format";

/** Inicio del Panel V1 (secciones 3 y 16 del brief). */
export async function SuperDashboard() {
  const month = todayMx().slice(0, 7);
  const range = monthRange(month);
  const previous = monthRange(shiftMonth(month, -1));

  let data;
  try {
    const [monthSummary, previousSummary, allTime, kpis, days, products, latest, attention] = await Promise.all([
      getFinanceSummary(range.from, range.to),
      getFinanceSummary(previous.from, previous.to),
      getFinanceSummary(null, null),
      getOperationalKpis(range.from, range.to),
      getSalesByDay(range.from, range.to),
      getSalesByProduct(range.from, range.to),
      listSales({ from: null, to: null, status: null, product: null, search: null, eventId: null, limit: 8, offset: 0 }),
      getAttentionItems(),
    ]);
    data = { monthSummary, previousSummary, allTime, kpis, days, products, latest, attention };
  } catch (error) {
    return (
      <>
        <DashboardTitle month={month} />
        <DataError error={error} />
      </>
    );
  }

  const { monthSummary, previousSummary, allTime, kpis, days, products, latest, attention } = data;
  const plans = products.filter((product) => product.item_type === "plan");
  const maxPlan = Math.max(1, ...plans.map((plan) => plan.ventas_brutas_cents));
  const urgent = attention.filter((item) => item.severity === "alta").length;

  return (
    <>
      <DashboardTitle month={month} />

      {/* Fila 1: dinero. Cobrado ≠ disponible: por eso el disponible va aparte y resaltado. */}
      <section aria-labelledby="money-row" className="mb-3">
        <h2 id="money-row" className="sr-only">
          Dinero
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MoneyTile
            label="Ventas del mes"
            cents={monthSummary.ventas_brutas_cents}
            hint={`${formatInt(monthSummary.numero_ventas)} ventas · mes anterior ${formatMxn(previousSummary.ventas_brutas_cents)}`}
            href="/ventas"
          />
          <MoneyTile
            label="Dinero recibido (mes)"
            cents={monthSummary.dinero_recibido_cents}
            hint={`Ventas menos reembolsos (${formatMxn(monthSummary.reembolsos_cents)}) y contracargos`}
            href="/finanzas"
          />
          <MoneyTile
            label="Dinero apartado (acumulado)"
            cents={allTime.dinero_apartado_cents}
            hint={`IVA ${formatMxn(allTime.iva_cobrado_cents)} + apartados ${formatMxn(allTime.apartados_reglas_cents)}. No es para gastar.`}
            href="/finanzas"
          />
          <MoneyTile
            label="Dinero realmente disponible"
            cents={allTime.dinero_disponible_cents}
            hint="Acumulado: recibido − comisiones − gastos − retiros − apartado. No es el saldo del banco."
            emphasis
            href="/finanzas"
          />
        </div>
      </section>

      {/* Detalle del mes que pide el brief (IVA, comisiones, gastos, utilidad). */}
      <div className="mb-6 grid grid-cols-2 gap-x-6 gap-y-1 rounded-xl border border-ink-150 bg-surface px-4 py-3 text-xs shadow-sm sm:grid-cols-4">
        <MonthFigure label="IVA cobrado (mes)" cents={monthSummary.iva_cobrado_cents} />
        <MonthFigure label="Comisiones Stripe (mes)" cents={monthSummary.comisiones_stripe_cents} />
        <MonthFigure label="Gastos del mes" cents={monthSummary.gastos_total_cents} />
        <MonthFigure label="Utilidad estimada (mes)" cents={monthSummary.resultado_operativo_cents} />
      </div>

      {/* Fila 2: operación. */}
      <section aria-labelledby="ops-row" className="mb-6">
        <h2 id="ops-row" className="sr-only">
          Operación
        </h2>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Stat label="Clientes nuevos (mes)" value={formatInt(kpis.clientes_nuevos)} href="/clientes" />
          <Stat
            label={`Clientes de pago · ${formatInt(kpis.clientes_gratuitos)} gratuitos`}
            value={formatInt(kpis.clientes_de_pago)}
            href="/clientes?filtro=paying"
          />
          <Stat
            label={`Eventos activos · ${formatInt(kpis.eventos_proximos)} próximos · ${formatInt(kpis.eventos_finalizados)} finalizados`}
            value={formatInt(kpis.eventos_activos)}
            href="/eventos"
          />
          <Stat
            label={`Pagos fallidos (mes) · ${formatInt(kpis.pagos_rechazados)} rechazados`}
            value={formatInt(kpis.pagos_fallidos)}
            href="/ventas?estado=failed"
          />
        </div>
      </section>

      {monthSummary.ventas_sin_datos_financieros > 0 && (
        <p className="mb-4 rounded-lg border border-gold-600 bg-gold-100 px-3 py-2 text-xs text-ink-800">
          {monthSummary.ventas_sin_datos_financieros} ventas del mes aún no tienen la comisión de Stripe registrada: las
          comisiones y el disponible están incompletos. Corre el backfill de datos financieros.
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card title={`Ventas por día · ${monthLabel(month)}`}>
          <SalesByDayChart
            days={days.map((day) => ({
              day: day.day,
              grossCents: day.ventas_brutas_cents,
              refundsCents: day.reembolsos_cents,
              count: day.numero_ventas,
            }))}
          />
        </Card>

        <Card title="Ventas por plan (mes)">
          {plans.length === 0 ? (
            <p className="text-ink-600">Sin ventas de planes este mes.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {plans.map((plan) => (
                <li key={plan.item_key}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{plan.item_name}</span>
                    <span className="tabular-nums text-ink-800">
                      {formatMxn(plan.ventas_brutas_cents)} · {plan.numero_ventas}
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-surface-2" aria-hidden="true">
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${(plan.ventas_brutas_cents / maxPlan) * 100}%`, background: "#a67c2e" }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-[13px] font-semibold">Últimas ventas</h2>
            <Link href="/ventas" className="text-xs font-semibold text-gold-800 hover:underline">
              Ver todas
            </Link>
          </div>
          <SalesTable rows={latest} compact empty="Todavía no hay ventas." />
        </div>

        <Card
          title={
            <span className="flex items-center justify-between gap-2">
              Requiere atención
              {urgent > 0 && <span className="text-xs font-semibold text-danger-700">{urgent} urgentes</span>}
            </span>
          }
        >
          <AttentionList items={attention} limit={8} />
          {attention.length > 8 && <p className="mt-2 text-xs text-ink-600">Y {attention.length - 8} más.</p>}
        </Card>
      </div>
    </>
  );
}

function DashboardTitle({ month }: { month: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-xl font-semibold text-ink-950">Inicio</h1>
      <p className="mt-1 text-ink-600">{monthLabel(month)} · cifras de la base de Celebraloo, sin cuentas de staff ni datos demo.</p>
    </div>
  );
}

function MonthFigure({ label, cents }: { label: string; cents: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1 sm:block">
      <p className="text-ink-600">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-ink-950">{formatMxn(cents)}</p>
    </div>
  );
}
