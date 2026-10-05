import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/components/ui";
import { formatDeltaBps } from "@/lib/format";
import type { MonthToDateRow } from "@/lib/data/admin";

/**
 * Variación contra los mismos días del mes anterior. Flecha + texto + color
 * tenue (nunca solo color). Sin dato anterior (o anterior = 0) no hay
 * porcentaje: la BD manda variacion_bps = null.
 */
export function Delta({ row }: { row: MonthToDateRow | undefined }) {
  if (!row) return null;
  if (row.variacion_bps === null) {
    return <p className="mt-1.5 text-xs text-ink-600">Sin datos del mes anterior</p>;
  }
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
 * Cifra del Inicio. size "lg" = fila principal (más grande y con más
 * contraste); "md" = fila secundaria. emphasis = la que más importa.
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
  const body = (
    <>
      <p className={cn("text-xs font-semibold", emphasis ? "text-gold-800" : "text-ink-600")}>{label}</p>
      <p className={cn("mt-1 font-semibold tabular-nums text-ink-950", size === "lg" ? "text-3xl" : "text-xl")}>{value}</p>
      {footer}
      {hint && <p className="mt-1 text-xs text-ink-600">{hint}</p>}
    </>
  );
  const className = cn(
    "block rounded-xl border shadow-sm",
    size === "lg" ? "p-4" : "px-4 py-3",
    emphasis ? "border-gold-600 bg-gold-100/60" : "border-ink-150 bg-surface"
  );
  return href ? (
    <Link href={href} className={cn(className, "transition-colors hover:border-gold-600")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
