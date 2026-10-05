import Link from "next/link";
import { AlertTriangle, ChevronRight, Info, OctagonAlert, type LucideIcon } from "lucide-react";
import { cn, formatDate } from "@/components/ui";
import type { AlertCount, AlertRow, AlertSeverity } from "@/lib/data/admin";

export const SEVERITY_META: Record<
  AlertSeverity,
  { label: string; plural: string; icon: LucideIcon; text: string; bg: string; border: string }
> = {
  rojo: { label: "Urgente", plural: "urgentes", icon: OctagonAlert, text: "text-danger-700", bg: "bg-danger-100", border: "border-danger-300" },
  amarillo: { label: "Atención", plural: "de atención", icon: AlertTriangle, text: "text-warn-700", bg: "bg-warn-100", border: "border-warn-300" },
  azul: { label: "Informativa", plural: "informativas", icon: Info, text: "text-info-700", bg: "bg-info-100", border: "border-info-300" },
};

export const SEVERITIES: AlertSeverity[] = ["rojo", "amarillo", "azul"];

/** Nombre de cada tipo para filtros y contadores (el título de cada alerta viene de la BD). */
export const ALERT_KINDS: Record<string, string> = {
  pago_fallido: "Pagos fallidos",
  contracargo: "Contracargos",
  pago_duplicado: "Pagos duplicados",
  pago_sin_plan: "Pagos sin plan asignado",
  error_webhook: "Errores de webhook",
  evento_sin_publicar: "Eventos próximos sin publicar",
  evento_sin_invitados: "Eventos próximos sin invitados",
  pago_sin_reclamar: "Pagos sin reclamar",
  reembolso_pendiente: "Reembolsos pendientes",
  registrado_sin_evento: "Registrados sin evento",
  evento_sin_publicar_usuario: "Con evento sin publicar",
  venta_sin_comision: "Ventas sin comisión registrada",
};

export function alertHref(item: Pick<AlertRow, "target_type" | "target_id">): string | null {
  if (!item.target_id) return null;
  if (item.target_type === "purchase") return `/ventas/${item.target_id}`;
  if (item.target_type === "event") return `/eventos/${item.target_id}`;
  if (item.target_type === "customer") return `/clientes/${item.target_id}`;
  return null;
}

export function SeverityIcon({ severity, size = 16 }: { severity: AlertSeverity; size?: number }) {
  const meta = SEVERITY_META[severity];
  const Icon = meta.icon;
  return <Icon size={size} className={cn("shrink-0", meta.text)} aria-hidden="true" />;
}

/** Lista clicable: cada alerta lleva al cliente, evento o venta. La BD ya la ordena (severidad, fecha). */
export function AlertList({ items, empty }: { items: AlertRow[]; empty: string }) {
  if (items.length === 0) return <p className="py-2 text-ink-600">{empty}</p>;
  return (
    <ul className="flex flex-col divide-y divide-ink-150">
      {items.map((item, index) => {
        const href = alertHref(item);
        const content = (
          <span className="flex items-start gap-2.5 py-2.5">
            <span className="mt-0.5">
              <SeverityIcon severity={item.severity} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-ink-950">
                <span className="sr-only">{SEVERITY_META[item.severity].label}: </span>
                {item.title}
              </span>
              {item.detail && <span className="block truncate text-xs text-ink-600">{item.detail}</span>}
              <span className="block text-xs text-ink-600">{formatDate(item.occurred_at, true)}</span>
            </span>
            {href && <ChevronRight size={16} className="mt-0.5 shrink-0 text-ink-400" aria-hidden="true" />}
          </span>
        );
        return (
          <li key={`${item.kind}-${item.target_id ?? "x"}-${index}`}>
            {href ? (
              <Link href={href} className="-mx-2 block rounded-md px-2 hover:bg-paper">
                {content}
              </Link>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Totales por severidad: ícono + número + texto, color tenue solo si hay alertas. */
export function SeverityTotals({ counts }: { counts: AlertCount[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {SEVERITIES.map((severity) => {
        const meta = SEVERITY_META[severity];
        const total = counts.filter((count) => count.severity === severity).reduce((sum, count) => sum + count.total, 0);
        return (
          <li
            key={severity}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
              total > 0 ? cn(meta.bg, meta.border, meta.text) : "border-ink-150 bg-surface text-ink-600"
            )}
          >
            <meta.icon size={13} aria-hidden="true" />
            <span className="tabular-nums">{total}</span> {meta.plural}
          </li>
        );
      })}
    </ul>
  );
}
