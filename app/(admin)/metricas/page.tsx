import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requirePermission } from "@/lib/auth/require-admin";
import { getMetrics, type FunnelStep, type Metrics } from "@/lib/data/admin";
import { addDays, dayRangeLabel, formatBps, formatInt, formatMxn, todayMx } from "@/lib/format";
import { Card, PageTitle, cn } from "@/components/ui";
import { DataError } from "@/components/finance";
import { fieldClass } from "@/components/filters";
import { KpiTile } from "@/components/kpi";
import { BarList, share } from "@/components/bar-list";

const PRESETS = {
  "30d": "Últimos 30 días",
  "90d": "Últimos 90 días",
  anio: "Este año",
  "12m": "Últimos 12 meses",
  personalizado: "Personalizado",
} as const;
type Preset = keyof typeof PRESETS;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** [desde, hasta) en días de CDMX. Personalizado: desde/hasta inclusivos, hasta 3 años. */
function period(params: { periodo?: string; desde?: string; hasta?: string }, today: string) {
  const preset: Preset = params.periodo && params.periodo in PRESETS ? (params.periodo as Preset) : "30d";
  const to = addDays(today, 1);
  if (preset === "personalizado" && params.desde && ISO_DAY.test(params.desde)) {
    const end = params.hasta && ISO_DAY.test(params.hasta) && params.hasta < today ? addDays(params.hasta, 1) : to;
    if (params.desde < end) return { preset, from: params.desde, to: end };
  }
  if (preset === "90d") return { preset, from: addDays(today, -89), to };
  if (preset === "anio") return { preset, from: `${today.slice(0, 4)}-01-01`, to };
  if (preset === "12m") return { preset, from: addDays(today, -364), to };
  return { preset: "30d" as Preset, from: addDays(today, -29), to };
}

const STEP_LABEL: Record<FunnelStep, string> = {
  registro: "Registro",
  evento: "Evento creado",
  compra: "Compra",
  publicada: "Invitación publicada",
};

function Funnel({ steps }: { steps: Metrics["funnel"] }) {
  const start = steps[0]?.usuarios ?? 0;
  if (start === 0) return <p className="text-ink-600">Nadie se registró en este periodo: no hay funnel que mostrar.</p>;
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step, index) => {
        const previous = index > 0 ? steps[index - 1].usuarios : null;
        const fromPrevious = previous === null ? null : share(step.usuarios, previous);
        return (
          <li key={step.paso}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium">
                <span className="mr-2 text-xs tabular-nums text-ink-600">{index + 1}.</span>
                {STEP_LABEL[step.paso]}
              </span>
              <span className="tabular-nums text-ink-800">
                <span className="font-semibold text-ink-950">{formatInt(step.usuarios)}</span> usuarios ·{" "}
                {formatBps(share(step.usuarios, start))} del registro
              </span>
            </div>
            <div className="mt-1 h-3 rounded bg-surface-2" aria-hidden="true">
              {step.usuarios > 0 && <div className="h-3 rounded" style={{ width: `${(step.usuarios / start) * 100}%`, background: "#a67c2e" }} />}
            </div>
            {fromPrevious !== null && (
              <p className="mt-1 flex items-center gap-1 text-xs text-ink-600">
                <ArrowRight size={12} aria-hidden="true" />
                {previous === 0 ? "Sin usuarios en el paso anterior." : `${formatBps(fromPrevious)} de "${STEP_LABEL[steps[index - 1].paso]}" llegó a este paso.`}
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
  const range = period(params, today);

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
      <PageTitle
        title="Métricas"
        subtitle={`Personas registradas del ${label} (sin staff). Ventas del mismo periodo. Uso: hoy.`}
      />

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div role="group" aria-label="Periodo de registro" className="inline-flex flex-wrap rounded-md border border-ink-250 bg-surface p-0.5">
          {(Object.keys(PRESETS) as Preset[]).map((preset) => (
            <Link
              key={preset}
              href={preset === "personalizado" ? `/metricas?periodo=personalizado&desde=${range.from}&hasta=${addDays(range.to, -1)}` : `/metricas?periodo=${preset}`}
              aria-current={preset === range.preset ? "true" : undefined}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
                preset === range.preset ? "bg-ink-950 text-surface" : "text-ink-800 hover:bg-paper"
              )}
            >
              {PRESETS[preset]}
            </Link>
          ))}
        </div>
        {range.preset === "personalizado" && (
          <form className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="periodo" value="personalizado" />
            <label className="flex flex-col gap-1 text-xs font-semibold text-ink-800">
              Desde
              <input type="date" name="desde" defaultValue={range.from} className={fieldClass} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-ink-800">
              Hasta
              <input type="date" name="hasta" defaultValue={addDays(range.to, -1)} className={fieldClass} />
            </label>
            <button className="h-9 rounded-md bg-ink-950 px-4 font-semibold text-surface hover:bg-ink-800">Aplicar</button>
          </form>
        )}
      </div>

      <Card title="Funnel · Registro → Evento creado → Compra → Invitación publicada" className="mb-6">
        <Funnel steps={metrics.funnel} />
        <p className="mt-3 text-xs text-ink-600">
          De quienes se registraron en el periodo. Cada paso cuenta a quien también cumplió los anteriores. Publicar exige un plan de pago,
          por eso la compra va antes. Quien pagó antes de registrarse cuenta igual: al reclamar su compra se crea su evento.
        </p>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Adquisición">
          <div className="mb-4 grid grid-cols-2 gap-3">
            <KpiTile size="md" label="Usuarios registrados" value={formatInt(acq.usuarios_registrados)} />
            <KpiTile size="md" label="Clientes nuevos" value={formatInt(acq.clientes_nuevos)} hint="Su primera compra fue en el periodo." />
          </div>
          <h3 className="mb-2 text-[13px] font-semibold">Fuente de adquisición</h3>
          <BarList
            empty="Nadie se registró en este periodo."
            items={acq.fuentes.map((source) => ({
              key: source.canal,
              label: source.canal,
              value: source.usuarios,
              shareBps: share(source.usuarios, acq.usuarios_registrados),
            }))}
          />
          <p className="mt-2 text-xs text-ink-600">
            «Sin dato» = se registró antes de que se capturara la fuente. «Directo» = sin UTM ni sitio de origen.
          </p>
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
          <p className="mt-2 text-xs text-ink-600">
            Porcentaje sobre {formatInt(act.registrados)} registrados. Los invitados de demostración no cuentan.
          </p>
        </Card>

        <Card title="Monetización">
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <KpiTile
              size="md"
              label="Conversión gratis a pago"
              value={mon.conversion_bps === null ? "—" : formatBps(mon.conversion_bps)}
              hint={act.registrados === 0 ? "Sin registros." : `${formatInt(mon.registrados_que_compraron)} de ${formatInt(act.registrados)} registrados.`}
            />
            <KpiTile
              size="md"
              label="Ticket promedio"
              value={mon.ticket_promedio_cents === null ? "—" : formatMxn(mon.ticket_promedio_cents)}
              hint={mon.transacciones === 0 ? "Aún no hay ventas en el periodo." : `${formatInt(mon.transacciones)} ventas.`}
            />
            <KpiTile
              size="md"
              label="Ventas con descuento"
              value={formatInt(mon.ventas_con_descuento)}
              hint={mon.descuentos_cents ? `−${formatMxn(mon.descuentos_cents)} en descuentos.` : "Sin cupones usados."}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-[13px] font-semibold">Ventas por plan</h3>
              <BarList
                empty="Aún no hay ventas de planes."
                items={plans.map((item) => ({ key: item.clave, label: item.nombre, value: item.ventas, shareBps: item.porcentaje_bps }))}
              />
            </div>
            <div>
              <h3 className="mb-2 text-[13px] font-semibold">Ventas por complemento</h3>
              <BarList
                empty="Aún no hay ventas de complementos."
                items={addons.map((item) => ({ key: item.clave, label: item.nombre, value: item.ventas, shareBps: item.porcentaje_bps }))}
              />
            </div>
          </div>
        </Card>

        <Card title="Uso (hoy)">
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <KpiTile size="md" label="Eventos activos" value={formatInt(uso.eventos_activos)} hint="Publicados y por venir." />
            <KpiTile size="md" label="Eventos próximos" value={formatInt(uso.eventos_proximos)} hint="En los próximos 30 días." />
            <KpiTile size="md" label="Usuarios activos" value={formatInt(uso.usuarios_activos_30d)} hint="Con actividad en los últimos 30 días." />
          </div>
          <h3 className="mb-2 text-[13px] font-semibold">Última actividad</h3>
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
          <p className="mt-2 text-xs text-ink-600">Todos los clientes (sin staff). Actividad = navegación en Celebraloo o inicio de sesión.</p>
        </Card>
      </div>
    </>
  );
}
