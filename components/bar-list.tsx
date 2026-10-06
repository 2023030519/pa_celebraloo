import { formatBps, formatInt } from "@/lib/format";

// Dorado de la marca, validado para gráficas (contraste 3:1 sobre la superficie).
const BAR_COLOR = "#a67c2e";

export type BarItem = { key: string; label: string; value: number; /** Puntos base del total (para el ancho y la etiqueta). */ shareBps: number | null; note?: string };

/**
 * Barras horizontales de una sola serie con etiqueta directa (cantidad y %).
 * El texto va en tinta; la barra solo indica tamaño.
 */
export function BarList({ items, empty, unit = "" }: { items: BarItem[]; empty: string; unit?: string }) {
  if (items.length === 0) return <p className="text-ink-600">{empty}</p>;
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item.key}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">{item.label}</span>
            <span className="shrink-0 tabular-nums text-ink-800">
              {formatInt(item.value)}
              {unit && ` ${unit}`}
              {item.shareBps !== null && <span className="ml-1.5 font-semibold text-ink-950">{formatBps(item.shareBps)}</span>}
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-surface-2" aria-hidden="true">
            {item.value > 0 && <div className="h-2 rounded-full" style={{ width: `${(item.value / max) * 100}%`, background: BAR_COLOR }} />}
          </div>
          {item.note && <p className="mt-0.5 text-xs text-ink-600">{item.note}</p>}
        </li>
      ))}
    </ul>
  );
}

/** share en puntos base de value sobre total (null si total = 0). */
export function share(value: number, total: number): number | null {
  return total > 0 ? Math.round((value * 10000) / total) : null;
}
