import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn, zeroClass } from "@/components/ui";
import { formatDeltaBps } from "@/lib/format";
import type { MonthToDateRow } from "@/lib/data/admin";

/**
 * Variación contra los mismos días del mes anterior. Flecha + texto + color
 * tenue (nunca solo color). Sin dato anterior (o anterior = 0) la BD manda
 * variacion_bps = null y no se muestra nada: la página pone una sola nota.
 */
export function Delta({ row }: { row: MonthToDateRow | undefined }) {
  if (!row || row.variacion_bps === null) return null;
  const up = row.variacion_bps > 0;
  const flat = row.variacion_bps === 0;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <p className={cn("mt-1.5 flex items-center gap-1 text-xs font-medium", flat ? "text-ink-600" : up ? "text-ok-700" : "text-danger-700")}>
      <Icon size={14} aria-hidden="true" />
      <span>{flat ? "Igual que el mes anterior" : `${formatDeltaBps(row.variacion_bps)} vs mes anterior`}</span>
    </p>
  );
}

/**
 * Cifra suelta (tarjeta). size "lg" = cifra principal; "md" = secundaria.
 * emphasis = la que más importa (borde y etiqueta en oro, sin fondo de color).
 */
export function KpiTile({
  label,
  value,
  footer,
  hint,
  href,
  size = "lg",
  emphasis = false,
}: {
  label: string;
  value: ReactNode;
  footer?: ReactNode;
  hint?: ReactNode;
  href?: string;
  size?: "lg" | "md";
  emphasis?: boolean;
}) {
  const className = cn(
    "block rounded-lg border bg-surface",
    size === "lg" ? "px-4 py-4" : "px-4 py-3",
    emphasis ? "border-gold-600" : "border-ink-150"
  );
  const body = <FigureBody label={label} value={value} footer={footer} hint={hint} size={size} emphasis={emphasis} />;
  return href ? (
    <Link href={href} className={cn(className, "transition-colors duration-[var(--dur-fast)] hover:bg-surface-2/60")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function FigureBody({
  label,
  value,
  footer,
  hint,
  size,
  emphasis = false,
}: {
  label: string;
  value: ReactNode;
  footer?: ReactNode;
  hint?: ReactNode;
  size: "lg" | "md" | "sm";
  emphasis?: boolean;
}) {
  return (
    <>
      {/* Una línea: así las cifras de una fila comparten línea base. */}
      <p className={cn("truncate text-[13px]", emphasis ? "font-medium text-gold-800" : "text-ink-600")} title={label}>
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-semibold tracking-[-0.015em] tabular-nums",
          // Un 0 (número o texto ya formateado) va atenuado; los nodos (<Nil />, etc.) quedan en tinta plena.
          typeof value === "string" || typeof value === "number" ? zeroClass(value, "text-ink-950") : "text-ink-950",
          size === "lg" ? "text-[22px] leading-8 sm:text-[28px] sm:leading-9" : size === "md" ? "text-xl" : "text-base"
        )}
      >
        {value}
      </p>
      {footer}
      {hint && <p className="mt-1 text-xs text-ink-600">{hint}</p>}
    </>
  );
}

/**
 * Franja de cifras: un solo panel con divisores finos en lugar de tarjetas
 * iguales. Cada fila puede tener su propio peso (lg, md, sm) y columnas.
 */
export function FigureStrip({ children }: { children: ReactNode }) {
  return <section className="grid gap-px overflow-hidden rounded-lg border border-ink-150 bg-ink-150">{children}</section>;
}

const COLS = { 2: "grid-cols-2", 3: "grid-cols-2 sm:grid-cols-3", 4: "grid-cols-2 xl:grid-cols-4" } as const;

export function FigureRow({ cols, children, label }: { cols: 2 | 3 | 4; children: ReactNode; label: string }) {
  return (
    <div role="group" aria-label={label} className={cn("grid gap-px max-sm:[&>*:last-child:nth-child(odd)]:col-span-2", COLS[cols])}>
      {children}
    </div>
  );
}

export function Figure({
  label,
  value,
  footer,
  hint,
  href,
  size = "lg",
  emphasis = false,
}: {
  label: string;
  value: ReactNode;
  footer?: ReactNode;
  hint?: ReactNode;
  href?: string;
  size?: "lg" | "md" | "sm";
  emphasis?: boolean;
}) {
  const className = cn("block bg-surface", size === "lg" ? "px-4 py-4 sm:px-5" : size === "md" ? "px-4 py-3.5 sm:px-5" : "px-4 py-2.5 sm:px-5");
  const body = <FigureBody label={label} value={value} footer={footer} hint={hint} size={size} emphasis={emphasis} />;
  return href ? (
    <Link href={href} className={cn(className, "transition-colors duration-[var(--dur-fast)] hover:bg-surface-2/70")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
