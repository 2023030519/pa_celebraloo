"use client";

import { useState } from "react";
import { formatMxn } from "@/lib/format";

export type ChartDay = { day: string; grossCents: number; refundsCents: number; count: number };

// Dorado de la marca, validado para gráficas (croma y contraste 3:1 sobre la superficie).
const BAR_COLOR = "#a67c2e";
const HEIGHT = 180;
const PAD = { top: 12, right: 8, bottom: 22, left: 56 };

/** Escala "bonita" para el eje: 0, 1k, 2k… en pasos de 1/2/5 × 10^n. */
function niceTicks(maxCents: number): number[] {
  const max = Math.max(maxCents, 100_00);
  const rough = max / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * power).find((candidate) => candidate >= rough) ?? rough;
  const ticks: number[] = [];
  for (let value = 0; value <= max + step * 0.001; value += step) ticks.push(value);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

const compact = new Intl.NumberFormat("es-MX", { notation: "compact", maximumFractionDigits: 1 });
const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));

export function SalesByDayChart({ days }: { days: ChartDay[] }) {
  const [active, setActive] = useState<number | null>(null);
  const ticks = niceTicks(Math.max(0, ...days.map((day) => day.grossCents)));
  const top = ticks[ticks.length - 1];
  const width = 720;
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const slot = plotW / Math.max(days.length, 1);
  const barW = Math.min(24, Math.max(2, slot - 2));
  const y = (cents: number) => PAD.top + plotH - (cents / top) * plotH;
  const labelEvery = days.length > 16 ? 5 : 1;
  const hovered = active === null ? null : days[active];

  return (
    <div>
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label="Ventas brutas por día">
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--ink-150)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--ink-600)">
                ${compact.format(tick / 100)}
              </text>
            </g>
          ))}
          {days.map((day, index) => {
            const x = PAD.left + index * slot + (slot - barW) / 2;
            const barTop = y(day.grossCents);
            const barH = PAD.top + plotH - barTop;
            const radius = Math.min(4, barH / 2, barW / 2);
            return (
              <g key={day.day}>
                {day.grossCents > 0 && (
                  // 4px redondeado arriba, cuadrado en la base.
                  <path
                    d={`M${x},${PAD.top + plotH} V${barTop + radius} Q${x},${barTop} ${x + radius},${barTop} H${x + barW - radius} Q${x + barW},${barTop} ${x + barW},${barTop + radius} V${PAD.top + plotH} Z`}
                    fill={BAR_COLOR}
                    opacity={active === null || active === index ? 1 : 0.45}
                  />
                )}
                {/* Zona de hover más grande que la barra: toda la columna. */}
                <rect
                  x={PAD.left + index * slot}
                  y={PAD.top}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${dayLabel(day.day)}: ${formatMxn(day.grossCents)}, ${day.count} ventas`}
                  onMouseEnter={() => setActive(index)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                />
                {(index % labelEvery === 0 || index === days.length - 1) && (
                  <text x={PAD.left + index * slot + slot / 2} y={HEIGHT - 6} textAnchor="middle" fontSize={11} fill="var(--ink-600)">
                    {Number(day.day.slice(8))}
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
            style={{ left: `${((PAD.left + active * slot + slot / 2) / width) * 100}%` }}
          >
            <p className="font-semibold text-ink-950">{dayLabel(hovered.day)}</p>
            <p className="text-ink-800">Ventas: {formatMxn(hovered.grossCents)}</p>
            <p className="text-ink-600">
              {hovered.count} {hovered.count === 1 ? "venta" : "ventas"}
              {hovered.refundsCents > 0 && ` · reembolsos ${formatMxn(hovered.refundsCents)}`}
            </p>
          </div>
        )}
      </div>
      <details className="mt-2 text-xs text-ink-600">
        <summary className="cursor-pointer font-semibold">Ver como tabla</summary>
        <div className="mt-2 max-h-56 overflow-y-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="py-1 font-semibold">Día</th>
                <th className="py-1 text-right font-semibold">Ventas</th>
                <th className="py-1 text-right font-semibold">Número</th>
                <th className="py-1 text-right font-semibold">Reembolsos</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr key={day.day} className="border-t border-ink-150">
                  <td className="py-1">{dayLabel(day.day)}</td>
                  <td className="py-1 text-right tabular-nums">{formatMxn(day.grossCents)}</td>
                  <td className="py-1 text-right tabular-nums">{day.count}</td>
                  <td className="py-1 text-right tabular-nums">{formatMxn(day.refundsCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
