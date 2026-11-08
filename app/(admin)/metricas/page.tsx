import type { Metadata } from "next";
import { CornerDownRight, Info } from "lucide-react";
import { requirePermission } from "@/lib/auth/require-admin";
import { getMetrics, type FunnelStep, type Metrics } from "@/lib/data/admin";
import { addDays, dayRangeLabel, formatBps, formatInt, formatMxn, todayMx } from "@/lib/format";
import { METRICS_PRESETS as PRESETS, metricsPeriod, type MetricsPreset } from "@/lib/reports";
import { Card, HowCalculated, Nil, PageTitle, Segmented, cn, ui, zeroClass } from "@/components/ui";
import { DataError } from "@/components/finance";
import { Field, fieldClass } from "@/components/filters";
import { Figure, FigureRow, FigureStrip } from "@/components/kpi";
import { BarList, share } from "@/components/bar-list";

export const metadata: Metadata = { title: "Métricas" };

const STEP_LABEL: Record<FunnelStep, string> = {
  registro: "Registro",
  evento: "Evento creado",
  compra: "Compra",
  publicada: "Invitación publicada",
};

const people = (count: number) => `${formatInt(count)} ${count === 1 ? "usuario" : "usuarios"}`;

function Funnel({ steps }: { steps: Metrics["funnel"] }) {
  const start = steps[0]?.usuarios ?? 0;
  if (start === 0) return <p className="text-sm text-ink-600">Nadie se registró en este periodo: no hay embudo que mostrar.</p>;
  return (
    <ol className="flex flex-col gap-4">
      {steps.map((step, index) => {
        const previous = index > 0 ? steps[index - 1].usuarios : null;
        const fromPrevious = previous === null ? null : share(step.usuarios, previous);
        return (
          <li key={step.paso}>
            {/* Bajo sm la cifra va siempre debajo del paso: los cuatro pasos comparten forma. */}
            <div className="flex flex-col gap-0.5 text-sm sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-3">
              <span className="font-medium text-ink-950">
                {/* El número sí informa: es el orden del funnel. */}
                <span className="mr-2 text-xs tabular-nums text-ink-600">{index + 1}.</span>
                {STEP_LABEL[step.paso]}
              </span>
              <span className={cn("tabular-nums", zeroClass(step.usuarios, "text-ink-600"))}>
                <span className={cn("font-semibold", zeroClass(step.usuarios, "text-ink-950"))}>{people(step.usuarios)}</span> · {formatBps(share(step.usuarios, start))} del registro
              </span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-surface-2" aria-hidden="true">
              {step.usuarios > 0 && <div className="h-2 rounded-full bg-gold-600" style={{ width: `${(step.usuarios / start) * 100}%` }} />}
            </div>
            {fromPrevious !== null && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-ink-600">
                <CornerDownRight size={12} aria-hidden="true" />
                {previous === 0 ? "Sin usuarios en el paso anterior." : `${formatBps(fromPrevious)} de “${STEP_LABEL[steps[index - 1].paso]}” llegó a este paso.`}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default async function MetricsPage({ searchParams }: { searchParams: Promise<{ periodo?: string; desde?: string; hasta?: string }> }) {
  await requirePermission("metricas.read");
  const params = await searchParams;
  const today = todayMx();
  const range = metricsPeriod(params, today);

  let metrics: Metrics;
  try {
    metrics = await getMetrics(range.from, range.to);
  } catch (error) {
    return (
      <>
        <PageTitle title="Métricas" />
        <DataError error={error} />
      </>
    );
  }

  const { adquisicion: acq, activacion: act, monetizacion: mon, uso } = metrics;
  const plans = mon.productos.filter((item) => item.tipo === "plan");
  const addons = mon.productos.filter((item) => item.tipo === "addon");
  const activityTotal = Object.values(uso.ultima_actividad).reduce((sum, value) => sum + value, 0);
  const label = dayRangeLabel(range.from, range.to);

  return (
    <>
      <PageTitle title="Métricas" subtitle={`Registros y ventas del ${label}`} />

      <div className="mb-4 flex flex-wrap items-end gap-x-4 gap-y-3">
        <Segmented
          wrap
          label="Periodo de registro"
          options={Object.entries(PRESETS) as [MetricsPreset, string][]}
          current={range.preset}
          href={(preset) =>
            preset === "personalizado" ? `/metricas?periodo=personalizado&desde=${range.from}&hasta=${addDays(range.to, -1)}` : `/metricas?periodo=${preset}`
          }
        />
        {range.preset === "personalizado" && (
          <form className="flex flex-wrap items-end gap-2 max-sm:grid max-sm:w-full max-sm:grid-cols-2">
            {/* En móvil el rango va a todo el ancho y Aplicar debajo, al pulgar. */}
            <input type="hidden" name="periodo" value="personalizado" />
            <Field label="Desde (dd/mm/aaaa)">
              <input type="date" lang="es-MX" name="desde" defaultValue={range.from} className={fieldClass} />
            </Field>
            <Field label="Hasta (dd/mm/aaaa)">
              <input type="date" lang="es-MX" name="hasta" defaultValue={addDays(range.to, -1)} className={fieldClass} />
            </Field>
            <button className={cn(ui.buttonSecondarySm, "max-sm:col-span-2")}>Aplicar</button>
          </form>
        )}
      </div>

      {range.notice && (
        <p role="status" className="mb-4 flex items-start gap-2 rounded-md border border-info-300 bg-info-100 px-3 py-2 text-[13px] text-info-700">
          <Info size={16} className="mt-px shrink-0" aria-hidden="true" />
          {range.notice}
        </p>
      )}

      {/* 1. Franja de cifras del periodo: adquisición y monetización. */}
      <h2 className="sr-only">Cifras del periodo</h2>
      <div className="mb-6">
        <FigureStrip>
          <FigureRow cols={4} label="Adquisición y conversión">
            <Figure label="Usuarios registrados" value={formatInt(acq.usuarios_registrados)} hint={label} />
            <Figure label="Clientes nuevos" value={formatInt(acq.clientes_nuevos)} hint="Su primera compra fue en el periodo." />
            <Figure
              label="Conversión a pago"
              value={mon.conversion_bps === null ? <Nil /> : formatBps(mon.conversion_bps)}
              hint={act.registrados === 0 ? "Sin registros." : `${formatInt(mon.registrados_que_compraron)} de ${formatInt(act.registrados)} registrados.`}
            />
            <Figure
              label="Ticket promedio"
              value={mon.ticket_promedio_cents === null ? <Nil /> : formatMxn(mon.ticket_promedio_cents)}
              hint={mon.transacciones === 0 ? "Aún no hay ventas en el periodo." : `${formatInt(mon.transacciones)} ventas.`}
            />
          </FigureRow>
          <FigureRow cols={2} label="Descuentos">
            <Figure size="sm" label="Ventas con descuento" value={formatInt(mon.ventas_con_descuento)} />
            <Figure
              size="sm"
              label="Descuentos"
              value={mon.descuentos_cents ? `−${formatMxn(mon.descuentos_cents)}` : formatMxn(0)}
              hint={mon.descuentos_cents ? undefined : "Sin cupones usados."}
            />
          </FigureRow>
        </FigureStrip>
      </div>

      {/* 2. Funnel. El orden de los pasos lo da la BD (antes de 20261107200000 la compra iba antes de publicar). */}
      <Card title="Embudo" className="mb-6">
        <Funnel steps={metrics.funnel} />
      </Card>

      {/* 3. Desglose del periodo. */}
      <div className="mb-8 grid gap-6 xl:grid-cols-2">
        <Card title="Fuente de adquisición">
          <BarList
            empty="Nadie se registró en este periodo."
            items={acq.fuentes.map((source) => ({
              key: source.canal,
              label: source.canal,
              value: source.usuarios,
              shareBps: share(source.usuarios, acq.usuarios_registrados),
            }))}
          />
        </Card>

        <Card title="Activación">
          <BarList
            empty="Nadie se registró en este periodo."
            unit="usuarios"
            items={
              act.registrados === 0
                ? []
                : [
                    { key: "evento", label: "Crean un evento", value: act.crean_evento, shareBps: share(act.crean_evento, act.registrados) },
                    { key: "invitados", label: "Agregan invitados", value: act.agregan_invitados, shareBps: share(act.agregan_invitados, act.registrados) },
                    { key: "publican", label: "Publican su invitación", value: act.publican_invitacion, shareBps: share(act.publican_invitacion, act.registrados) },
                  ]
            }
          />
        </Card>

        <Card title="Ventas por plan">
          <BarList
            empty="Aún no hay ventas de planes."
            items={plans.map((item) => ({ key: item.clave, label: item.nombre, value: item.ventas, shareBps: item.porcentaje_bps }))}
          />
        </Card>

        <Card title="Ventas por complemento">
          <BarList
            empty="Aún no hay ventas de complementos."
            items={addons.map((item) => ({ key: item.clave, label: item.nombre, value: item.ventas, shareBps: item.porcentaje_bps }))}
          />
        </Card>
      </div>

      {/* 4. Uso: foto de hoy, no depende del periodo elegido. */}
      <section aria-labelledby="usage">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="usage" className="text-base font-semibold text-ink-950">
            Uso hoy
          </h2>
          <p className="text-[13px] text-ink-600">Todos los clientes (sin staff). No depende del periodo.</p>
        </div>
        <FigureStrip>
          <FigureRow cols={3} label="Uso hoy">
            <Figure size="md" label="Eventos activos" value={formatInt(uso.eventos_activos)} hint="Publicados y por venir." />
            <Figure
              size="md"
              label="Eventos próximos"
              value={formatInt(uso.eventos_proximos)}
              hint={uso.dias_proximo ? `En los próximos ${formatInt(uso.dias_proximo)} días.` : "En los días de “Próximo” de Configuración."}
            />
            <Figure size="md" label="Usuarios activos" value={formatInt(uso.usuarios_activos_30d)} hint="Con actividad en los últimos 30 días." />
          </FigureRow>
          <div className="bg-surface px-5 py-4">
            <h3 className="mb-3 text-[13px] font-semibold text-ink-950">Última actividad</h3>
            <BarList
              empty="Aún no hay clientes."
              unit="usuarios"
              items={
                activityTotal === 0
                  ? []
                  : [
                      { key: "7", label: "Hace menos de 7 días", value: uso.ultima_actividad.menos_7_dias, shareBps: share(uso.ultima_actividad.menos_7_dias, activityTotal) },
                      { key: "30", label: "De 7 a 30 días", value: uso.ultima_actividad.de_7_a_30_dias, shareBps: share(uso.ultima_actividad.de_7_a_30_dias, activityTotal) },
                      { key: "90", label: "De 30 a 90 días", value: uso.ultima_actividad.de_30_a_90_dias, shareBps: share(uso.ultima_actividad.de_30_a_90_dias, activityTotal) },
                      { key: "mas", label: "Hace más de 90 días", value: uso.ultima_actividad.mas_de_90_dias, shareBps: share(uso.ultima_actividad.mas_de_90_dias, activityTotal) },
                      { key: "nunca", label: "Sin actividad registrada", value: uso.ultima_actividad.nunca, shareBps: share(uso.ultima_actividad.nunca, activityTotal) },
                    ]
              }
            />
          </div>
        </FigureStrip>
      </section>

      {/* R8: una sola ayuda por página, con un subtítulo por tema. */}
      <HowCalculated className="mt-6">
        <p className="font-medium text-ink-800">Cifras del periodo</p>
        <p>Personas registradas del {label} (sin staff). Ventas del mismo periodo. Uso: hoy.</p>
        <p>Conversión a pago: de quienes se registraron en el periodo, cuántos pagaron.</p>
        <p className="mt-2 font-medium text-ink-800">Embudo</p>
        <p>
          De quienes se registraron en el periodo. Cada paso cuenta a quien también cumplió los anteriores. Con Esencial se publica sin
          pagar. Quien pagó antes de registrarse cuenta igual: al reclamar su compra se crea su evento.
        </p>
        <p className="mt-2 font-medium text-ink-800">Fuente de adquisición</p>
        <p>“Sin dato” = se registró antes de que se capturara la fuente. “Directo” = sin UTM ni sitio de origen.</p>
        <p className="mt-2 font-medium text-ink-800">Activación</p>
        <p>Porcentaje sobre {formatInt(act.registrados)} registrados. Los invitados de demostración no cuentan.</p>
        <p className="mt-2 font-medium text-ink-800">Última actividad</p>
        <p>Actividad = navegación en Celebraloo o inicio de sesión.</p>
      </HowCalculated>
    </>
  );
}
