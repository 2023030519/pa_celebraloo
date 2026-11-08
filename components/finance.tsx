import Link from "next/link";
import type { ReactNode } from "react";
import { CircleSlash, Clock } from "lucide-react";
import { Badge, Nil, Table, cn, formatDate, zeroClass } from "@/components/ui";
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
      <p className={cn("text-[13px]", emphasis ? "font-medium text-gold-800" : "text-ink-600")}>{label}</p>
      <p className={cn("mt-1 text-[28px] leading-9 font-semibold tracking-[-0.015em] tabular-nums", zeroClass(cents, "text-ink-950"))}>{formatMxn(cents)}</p>
      {hint && <p className="mt-1 text-xs text-ink-600">{hint}</p>}
    </>
  );
  const className = cn(
    "block rounded-lg border bg-surface px-4 py-4",
    emphasis ? "border-gold-600" : "border-ink-150"
  );
  return href ? (
    <Link href={href} className={cn(className, "transition-colors duration-[var(--dur-fast)] hover:bg-surface-2/60")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function PaymentStatusBadge({ status }: { status: string }) {
  const meta = PAYMENT_STATUS[status] ?? { label: status, tone: "neutral" as const };
  // Los tonos neutros no traen ícono propio en Badge: estos estados lo necesitan.
  const Icon = status === "pending" ? Clock : status === "cancelled" ? CircleSlash : null;
  return Icon ? (
    <Badge tone={meta.tone}>
      <Icon size={12} aria-hidden="true" />
      {meta.label}
    </Badge>
  ) : (
    <Badge tone={meta.tone}>{meta.label}</Badge>
  );
}

export function EventStatusBadge({ status }: { status: string }) {
  const meta = EVENT_STATUS[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

/**
 * Tabla de ventas (Inicio y Ventas). compact oculta evento e IVA/comisión/neto;
 * financials = false (rol sin ventas.financiero) oculta solo IVA/comisión/neto,
 * que la BD no le manda. En móvil solo quedan Cliente (con la fecha debajo),
 * Total y Estado; toda la fila abre la venta.
 */
export function SalesTable({
  rows,
  compact = false,
  financials = true,
  empty,
  title,
  aside,
}: {
  rows: SaleRow[];
  compact?: boolean;
  financials?: boolean;
  empty: string;
  title?: ReactNode;
  aside?: ReactNode;
}) {
  const money = !compact && financials;
  const head = compact
    ? ["Fecha", "Cliente", "Producto", "Total (IVA incluido)", "Estado"]
    : ["Fecha", "Cliente", "Evento", "Producto", "Total (IVA incluido)", ...(money ? ["IVA", "Comisión", "Neto"] : []), "Estado"];
  const moneyColumns = new Set(["Total (IVA incluido)", "IVA", "Comisión", "Neto"]);
  const align = head.map((label) => (moneyColumns.has(label) ? "right" : "left") as "left" | "right");
  const keep = new Set(["Cliente", "Total (IVA incluido)", "Estado"]);
  const mobileHide = head.flatMap((label, index) => (keep.has(label) ? [] : [index]));
  return (
    <Table head={head} align={align} mobileHide={mobileHide} mobileCards title={title} aside={aside} empty={rows.length === 0 ? empty : undefined}>
      {rows.map((row) => (
        <tr key={row.id} className="relative">
          <td className="px-3 py-2.5 whitespace-nowrap text-ink-600">
            <Link href={`/ventas/${row.id}`} className="hover:underline">
              {formatDate(row.sale_at, true)}
            </Link>
          </td>
          <td className="px-3 py-2.5">
            {/* Persona: nombre arriba y correo abajo; sin nombre, el correo va arriba. Nada se parte a media palabra. */}
            <div className="sm:max-w-64">
              {row.customer_id ? (
                <Link
                  href={`/clientes/${row.customer_id}`}
                  title={row.customer_name ?? row.customer_email}
                  className="relative z-10 block w-fit max-w-full truncate font-medium text-ink-950 hover:underline"
                >
                  {row.customer_name ?? row.customer_email}
                </Link>
              ) : (
                <p className="truncate font-medium text-ink-950" title={row.customer_email}>
                  {row.customer_email}
                </p>
              )}
              {row.customer_name && (
                <p className="truncate text-xs text-ink-600" title={row.customer_email}>
                  {row.customer_email}
                </p>
              )}
              <p className="text-xs text-ink-600 tabular-nums sm:hidden">{formatDate(row.sale_at, true)}</p>
            </div>
          </td>
          {!compact && (
            <td className="px-3 py-2.5">
              {row.event_id ? (
                <Link href={`/eventos/${row.event_id}`} className="relative z-10 hover:underline">
                  {row.event_name ?? "Evento"}
                </Link>
              ) : (
                <span className="text-ink-600">Sin evento</span>
              )}
            </td>
          )}
          <td className="px-3 py-2.5">
            {row.item_name ?? <Nil />}
            {row.item_type === "addon" && <span className="ml-1 text-xs text-ink-600">(complemento)</span>}
          </td>
          <td className={cn("px-3 py-2.5 text-right tabular-nums font-medium", zeroClass(row.total_cents))}>
            {/* El enlace del total cubre la fila: clic en cualquier parte abre la venta. */}
            <Link href={`/ventas/${row.id}`} className="after:absolute after:inset-0 hover:underline">
              {formatMxn(row.total_cents)}
            </Link>
          </td>
          {money && (
            <>
              <td className={cn("px-3 py-2.5 text-right tabular-nums", zeroClass(row.tax_cents, "text-ink-800"))}>{formatMxn(row.tax_cents)}</td>
              <td className={cn("px-3 py-2.5 text-right tabular-nums", zeroClass(row.stripe_fee_cents, "text-ink-800"))}>{formatMxn(row.stripe_fee_cents)}</td>
              <td className={cn("px-3 py-2.5 text-right tabular-nums", zeroClass(row.net_cents, "text-ink-800"))}>{formatMxn(row.net_cents)}</td>
            </>
          )}
          <td className="px-3 py-2.5">
            <div className="flex flex-wrap gap-1">
              <PaymentStatusBadge status={row.display_status} />
            </div>
          </td>
        </tr>
      ))}
    </Table>
  );
}

/** Error de datos visible (p. ej. migración pendiente) en lugar de romper la página. */
export function DataError({ error }: { error: unknown }) {
  return (
    <div role="alert" className="rounded-lg border border-danger-300 bg-danger-100 px-4 py-3 text-danger-700">
      <p className="font-semibold">No se pudieron cargar los datos.</p>
      <p className="mt-1 text-sm">{error instanceof Error ? error.message : String(error)}</p>
    </div>
  );
}
