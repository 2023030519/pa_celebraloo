"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { formatInt, formatMxn } from "@/lib/format";

export type ChartPoint = { start: string; end: string; value: number };
export type ChartBucket = "day" | "week" | "month";

// Dorado de la marca, validado para gráficas (croma y contraste 3:1 sobre la superficie).
const BAR_COLOR = "#a67c2e";
const HEIGHT = 200;
const PAD = { top: 12, right: 8, bottom: 24, left: 56 };

const compact = new Intl.NumberFormat("es-MX", { notation: "compact", maximumFractionDigits: 1 });
const date = (iso: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("es-MX", { ...options, timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));

function addDay(iso: string, days: number): string {
  const value = new Date(`${iso}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Escala "bonita": pasos de 1/2/5 × 10^n. Conteos: nunca pasos fraccionarios. */
function niceTicks(max: number, money: boolean): number[] {
  const floor = money ? 100_00 : 4;
  const top = Math.max(max, floor);
  const rough = top / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * power).find((candidate) => candidate >= rough) ?? rough);
  const ticks: number[] = [];
  for (let value = 0; value <= top + step * 0.001; value += step) ticks.push(value);
  if (ticks[ticks.length - 1] < top) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

function bucketLabel(point: ChartPoint, bucket: ChartBucket): string {
  const last = addDay(point.end, -1);
  if (bucket === "day") return date(point.start, { weekday: "short", day: "numeric", month: "short" });
  if (bucket === "week") {
    return point.start === last
      ? date(point.start, { day: "numeric", month: "short" })
      : `${date(point.start, { day: "numeric", month: "short" })} – ${date(last, { day: "numeric", month: "short" })}`;
  }
  return date(point.start, { month: "long", year: "numeric" });
}

function axisLabel(point: ChartPoint, bucket: ChartBucket): string {
  if (bucket === "month") return date(point.start, { month: "short" });
  if (bucket === "week") return date(point.start, { day: "numeric", month: "short" });
  return date(point.start, { day: "numeric" });
}

/** Barras de una sola serie (la métrica elegida). Una serie: sin leyenda, el título la nombra. */
export function MetricChart({
  points,
  bucket,
  money,
  metricLabel,
  emptyText,
  unit,
}: {
  points: ChartPoint[];
  bucket: ChartBucket;
  money: boolean;
  metricLabel: string;
  emptyText: string;
  /** Unidad de cada barra ("Por día"); va en la línea de "Ver como tabla". */
  unit: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  // viewBox = ancho real en píxeles: el texto de 11px se ve de 11px en cualquier pantalla.
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const max = Math.max(0, ...points.map((point) => point.value));
  const allZero = max === 0;
  // Depende de allZero: la franja vacía y la gráfica montan elementos distintos.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(320, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [allZero]);
  const format = (value: number) => (money ? formatMxn(value) : formatInt(value));
  const ticks = niceTicks(max, money);
  const top = ticks[ticks.length - 1];
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const slot = plotW / Math.max(points.length, 1);
  const barW = Math.min(28, Math.max(2, slot - 2));
  const y = (value: number) => PAD.top + plotH - (value / top) * plotH;
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(3, Math.floor(plotW / 56))));
  const hovered = active === null ? null : points[active];

  // Serie toda en cero: franja compacta con el mensaje, sin ejes ni tabla de ceros. El ref se queda montado para medir al volver a haber datos.
  if (allZero) {
    return (
      <div ref={ref}>
        <p className="flex h-[72px] items-center justify-center rounded-md bg-surface-2 px-4 text-center text-sm text-ink-600">{emptyText}</p>
      </div>
    );
  }

  return (
    <div>
      <div ref={ref} className="relative">
        <svg viewBox={`0 0 ${width} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label={`${metricLabel} por periodo`}>
          {ticks.map((tick) => (
            <g key={tick}>
              {tick > 0 && <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--ink-150)" strokeWidth={1} />}
              <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--ink-600)">
                {money ? `$${compact.format(tick / 100)}` : compact.format(tick)}
              </text>
            </g>
          ))}
          {points.map((point, index) => {
            const x = PAD.left + index * slot + (slot - barW) / 2;
            const barTop = y(point.value);
            const barH = PAD.top + plotH - barTop;
            const radius = Math.min(4, barH / 2, barW / 2);
            return (
              <g key={point.start}>
                {point.value > 0 && (
                  // 4px redondeado arriba, cuadrado en la base.
                  <path
                    d={`M${x},${PAD.top + plotH} V${barTop + radius} Q${x},${barTop} ${x + radius},${barTop} H${x + barW - radius} Q${x + barW},${barTop} ${x + barW},${barTop + radius} V${PAD.top + plotH} Z`}
                    fill={BAR_COLOR}
                    opacity={active === null || active === index ? 1 : 0.45}
                  />
                )}
                {/* Zona de hover (solo ratón) de toda la columna; con teclado se usa "Ver como tabla". */}
                <rect
                  x={PAD.left + index * slot}
                  y={PAD.top}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setActive(index)}
                  onMouseLeave={() => setActive(null)}
                />
                {(index % labelEvery === 0 || index === points.length - 1) && (
                  <text x={PAD.left + index * slot + slot / 2} y={HEIGHT - 6} textAnchor="middle" fontSize={11} fill="var(--ink-600)">
                    {axisLabel(point, bucket)}
                  </text>
                )}
              </g>
            );
          })}
          <line x1={PAD.left} x2={width - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} stroke="var(--ink-250)" strokeWidth={1} />
        </svg>
        {hovered && active !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 w-max -translate-x-1/2 rounded-lg border border-ink-150 bg-surface px-3 py-2 text-xs shadow-md"
            style={{ left: `${Math.min(88, Math.max(12, ((PAD.left + active * slot + slot / 2) / width) * 100))}%` }}
          >
            <p className="font-semibold text-ink-950">{bucketLabel(hovered, bucket)}</p>
            <p className="text-ink-800">
              {metricLabel}: <span className="font-semibold tabular-nums">{format(hovered.value)}</span>
            </p>
          </div>
        )}
      </div>
      {/* "Ver como tabla · unidad" en una línea; abierta, la tabla toma el ancho completo. */}
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-600">
      <details className="group open:basis-full">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1 rounded-sm py-0.5 font-medium transition-colors duration-[var(--dur-fast)] hover:text-ink-950 [&::-webkit-details-marker]:hidden">
          Ver como tabla
          <ChevronRight size={14} aria-hidden="true" className="transition-transform duration-[var(--dur-fast)] group-open:rotate-90 motion-reduce:transition-none" />
        </summary>
        <div className="mt-2 max-h-56 overflow-y-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="py-1 font-semibold">Periodo</th>
                <th className="py-1 text-right font-semibold">{metricLabel}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.start} className="border-t border-ink-150">
                  <td className="py-1">{bucketLabel(point, bucket)}</td>
                  <td className="py-1 text-right tabular-nums">{format(point.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <span aria-hidden="true">·</span>
      <span>{unit}</span>
      </div>
    </div>
  );
}
