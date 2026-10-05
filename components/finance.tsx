import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, Table, cn, formatDate } from "@/components/ui";
import { EVENT_STATUS, PAYMENT_STATUS, formatMxn } from "@/lib/format";
import type { SaleRow } from "@/lib/data/admin";

/** Una cifra de dinero. emphasis = la que importa (dinero disponible). */
export function MoneyTile({
  label,
  cents,
  hint,
  emphasis = false,
  href,
}: {
  label: string;
  cents: number | null | undefined;
  hint?: ReactNode;
  emphasis?: boolean;
  href?: string;
}) {
  const body = (
    <>
      <p className={cn("text-xs font-semibold", emphasis ? "text-gold-800" : "text-ink-600")}>{label}</p>
      <p className={cn("mt-1 font-semibold tabular-nums", emphasis ? "text-3xl text-ink-950" : "text-2xl")}>{formatMxn(cents)}</p>
      {hint && <p className="mt-1 text-xs text-ink-600">{hint}</p>}
    </>
  );
  const className = cn(
    "block rounded-xl border p-4 shadow-sm",
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

export function PaymentStatusBadge({ status }: { status: string }) {
  const meta = PAYMENT_STATUS[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function EventStatusBadge({ status }: { status: string }) {
  const meta = EVENT_STATUS[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

/** Tabla de ventas (Inicio y Ventas). compact oculta IVA/comisión/neto. */
export function SalesTable({ rows, compact = false, empty }: { rows: SaleRow[]; compact?: boolean; empty: string }) {
  const head = compact
    ? ["Fecha", "Cliente", "Producto", "Total", "Estado"]
    : ["Fecha", "Cliente", "Evento", "Producto", "Total", "IVA", "Comisión", "Neto", "Estado"];
  return (
    <Table head={head} empty={rows.length === 0 ? empty : undefined}>
      {rows.map((row) => (
        <tr key={row.id} className="hover:bg-paper">
          <td className="px-3 py-2.5 whitespace-nowrap text-ink-600">
            <Link href={`/ventas/${row.id}`} className="hover:underline">
              {formatDate(row.sale_at, true)}
            </Link>
          </td>
          <td className="px-3 py-2.5">
            {row.customer_id ? (
              <Link href={`/clientes/${row.customer_id}`} className="font-medium hover:underline">
                {row.customer_name ?? row.customer_email}
              </Link>
            ) : (
              <span className="font-medium">{row.customer_email}</span>
            )}
            {row.customer_name && <p className="text-xs text-ink-600">{row.customer_email}</p>}
          </td>
          {!compact && (
            <td className="px-3 py-2.5">
              {row.event_id ? (
                <Link href={`/eventos/${row.event_id}`} className="hover:underline">
                  {row.event_name ?? "Evento"}
                </Link>
              ) : (
                <span className="text-ink-600">Sin evento</span>
              )}
            </td>
          )}
          <td className="px-3 py-2.5">
            {row.item_name ?? "—"}
            {row.item_type === "addon" && <span className="ml-1 text-xs text-ink-600">(complemento)</span>}
          </td>
          <td className="px-3 py-2.5 text-right tabular-nums font-medium">
            <Link href={`/ventas/${row.id}`} className="hover:underline">
              {formatMxn(row.total_cents)}
            </Link>
          </td>
          {!compact && (
            <>
              <td className="px-3 py-2.5 text-right tabular-nums text-ink-800">{formatMxn(row.tax_cents)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-ink-800">{formatMxn(row.stripe_fee_cents)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-ink-800">{formatMxn(row.net_cents)}</td>
            </>
          )}
          <td className="px-3 py-2.5">
            <PaymentStatusBadge status={row.display_status} />
          </td>
        </tr>
      ))}
    </Table>
  );
}

/** Error de datos visible (p. ej. migración pendiente) en lugar de romper la página. */
export function DataError({ error }: { error: unknown }) {
  return (
    <div role="alert" className="rounded-xl border border-danger-700/40 bg-danger-100 p-4 text-danger-700">
      <p className="font-semibold">No se pudieron cargar los datos.</p>
      <p className="mt-1 text-sm">{error instanceof Error ? error.message : String(error)}</p>
    </div>
  );
}
