import { formatBps, formatInt } from "@/lib/format";
import { zeroClass } from "@/components/ui";

export type BarItem = { key: string; label: string; value: number; /** Puntos base del total (para el ancho y la etiqueta). */ shareBps: number | null; note?: string };

/**
 * Barras horizontales de una sola serie con etiqueta directa (cantidad y %).
 * El texto va en tinta; la barra (oro de marca, 3:1 sobre la superficie) solo indica tamaño.
 */
export function BarList({ items, empty, unit = "" }: { items: BarItem[]; empty: string; unit?: string }) {
  if (items.length === 0) return <p className="text-sm text-ink-600">{empty}</p>;
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.key}>
          {/* Bajo sm la etiqueta y su cifra van apiladas: todas las filas comparten forma y nada se corta. */}
          <div className="flex flex-col gap-0.5 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
            <span className="min-w-0 text-ink-950 sm:truncate" title={item.label}>
              {item.label}
            </span>
            <span className={`shrink-0 tabular-nums ${zeroClass(item.value, "text-ink-600")}`}>
              {formatInt(item.value)}
              {/* Las unidades llegan en plural ("usuarios"); con 1 se quita la s final. */}
              {unit && ` ${item.value === 1 ? unit.replace(/s$/, "") : unit}`}
              {/* Separador en el texto, no solo en CSS: un lector de pantalla leía "675%" por "6 · 75 %". */}
              {item.shareBps !== null && (
                <>
                  {" · "}
                  <span className={`font-medium ${zeroClass(item.shareBps, "text-ink-950")}`}>{formatBps(item.shareBps)}</span>
                </>
              )}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-surface-2" aria-hidden="true">
            {item.value > 0 && <div className="h-1.5 rounded-full bg-gold-600" style={{ width: `${(item.value / max) * 100}%` }} />}
          </div>
          {item.note && <p className="mt-1 text-xs text-ink-600">{item.note}</p>}
        </li>
      ))}
    </ul>
  );
}

/** share en puntos base de value sobre total (null si total = 0). */
export function share(value: number, total: number): number | null {
  return total > 0 ? Math.round((value * 10000) / total) : null;
}
