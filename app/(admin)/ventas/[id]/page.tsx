import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Undo2 } from "lucide-react";
import { requirePermission } from "@/lib/auth/require-admin";
import { getSaleDetail } from "@/lib/data/admin";
import { formatMxn } from "@/lib/format";
import { stripeDisputeUrl, stripePaymentUrl } from "@/lib/stripe-links";
import { Badge, Card, PageTitle, Table, formatDate } from "@/components/ui";
import { DataError, PaymentStatusBadge } from "@/components/finance";
import { NotesPanel } from "@/components/notes-panel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-ink-150 py-2 last:border-b-0">
      <dt className="text-ink-600">{label}</dt>
      <dd className="min-w-0 text-right font-medium break-all tabular-nums">{children}</dd>
    </div>
  );
}

export default async function SalePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("ventas.read");
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  let detail;
  try {
    detail = await getSaleDetail(id);
  } catch (error) {
    return <DataError error={error} />;
  }
  if (!detail) notFound();

  const { sale } = detail;
  // Sin ventas.financiero la BD no manda subtotal, IVA, comisión ni neto.
  const fin = detail.financials_visible !== false;
  const customerId = detail.customer_id ?? sale.profile_id;
  const refund = detail.refund_summary ?? null;
  const paymentUrl = stripePaymentUrl(sale.provider_payment_intent_id);
  const linkClass = "font-medium text-ink-950 underline decoration-ink-250 underline-offset-2 hover:decoration-ink-950";

  return (
    <>
      <PageTitle
        title={`${sale.item_name ?? "Venta"} · ${formatMxn(sale.amount_total_cents)}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <PaymentStatusBadge status={sale.display_status} />
            {formatDate(sale.paid_at ?? sale.created_at, true)}
            {detail.has_failed_attempt && <Badge tone="danger">Tuvo intentos rechazados</Badge>}
          </span>
        }
        actions={
          paymentUrl && (
            <a
              href={paymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-ink-250 bg-surface px-3 font-semibold text-ink-800 hover:bg-paper"
            >
              Abrir pago en Stripe <ExternalLink size={14} aria-hidden="true" />
            </a>
          )
        }
      />

      {refund && (
        <div
          role="note"
          className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-info-300 bg-info-100 px-4 py-3 text-info-700"
        >
          <span className="flex items-center gap-1.5 font-semibold">
            <Undo2 size={16} aria-hidden="true" />
            Reembolso {refund.kind === "total" ? "total" : "parcial"}
          </span>
          <span className="tabular-nums">
            {formatMxn(refund.refunded_cents)} de {formatMxn(sale.amount_total_cents)}
          </span>
          <span>{formatDate(refund.last_refund_at, true)}</span>
        </div>
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card title="Venta">
          <dl>
            <Row label="Cliente">
              {customerId ? (
                <Link href={`/clientes/${customerId}`} className={linkClass}>
                  {detail.customer_name ?? sale.email}
                </Link>
              ) : (
                <span>{sale.email}</span>
              )}
              {detail.customer_name && <span className="block text-xs font-normal text-ink-600">{sale.email}</span>}
              {!customerId && <span className="block text-xs font-normal text-ink-600">Aún no tiene cuenta</span>}
            </Row>
            <Row label="Evento">
              {sale.event_id ? (
                <Link href={`/eventos/${sale.event_id}`} className={linkClass}>
                  {detail.event_name ?? "Evento"}
                </Link>
              ) : (
                <span className="text-ink-600">{sale.claimed_at ? "Sin evento asociado" : "Sin reclamar todavía"}</span>
              )}
            </Row>
            <Row label="Producto">
              {sale.item_name ?? "—"} {sale.item_type === "addon" ? "(complemento)" : sale.item_type === "plan" ? "(plan)" : ""}
            </Row>
            <Row label="Tipo de compra">
              {sale.billing_mode === "prorated_upgrade" ? "Diferencia de plan (mejora)" : sale.checkout_intent === "upgrade" ? "Mejora" : "Normal"}
            </Row>
            <Row label="Fecha de pago">{sale.paid_at ? formatDate(sale.paid_at, true) : "Sin cobrar"}</Row>
            <Row label="Estado">
              <PaymentStatusBadge status={sale.display_status} />
            </Row>
            <Row label="Referencia (Payment Intent)">
              <span className="font-mono text-xs">{sale.provider_payment_intent_id ?? "—"}</span>
            </Row>
            <Row label="Reclamada">{sale.claimed_at ? formatDate(sale.claimed_at, true) : "Sin reclamar"}</Row>
          </dl>
        </Card>

        <Card title="Dinero">
          <dl>
            {fin && <Row label="Subtotal">{formatMxn(sale.subtotal_cents)}</Row>}
            {fin && (
              <Row label={`IVA${sale.tax_rate_bps != null ? ` (${sale.tax_rate_bps / 100}%)` : ""}`}>{formatMxn(sale.tax_cents)}</Row>
            )}
            <Row label="Total cobrado">{formatMxn(sale.amount_total_cents)}</Row>
            {fin && <Row label="Comisión de Stripe">{formatMxn(sale.stripe_fee_cents)}</Row>}
            {fin && <Row label="Neto">{formatMxn(sale.net_cents)}</Row>}
            <Row label="Reembolsado">
              {refund ? `${formatMxn(refund.refunded_cents)} (${refund.kind})` : formatMxn(0)}
            </Row>
          </dl>
          {!fin && <p className="mt-3 text-xs text-ink-600">Tu rol no ve el desglose financiero (subtotal, IVA, comisión y neto).</p>}
          {fin && sale.paid_at && sale.stripe_fee_cents === null && (
            <p className="mt-3 text-xs text-warn-700">Aún sin comisión de Stripe: llega con el webhook o con el backfill.</p>
          )}
          <details className="mt-3 text-xs text-ink-600">
            <summary className="cursor-pointer font-semibold">Identificadores técnicos</summary>
            <dl className="mt-2">
              <Row label="ID interno">
                <span className="font-mono">{sale.id}</span>
              </Row>
              <Row label="Checkout Session">
                <span className="font-mono">{sale.provider_checkout_session_id ?? "—"}</span>
              </Row>
              <Row label="Cargo">
                <span className="font-mono">{sale.stripe_charge_id ?? "—"}</span>
              </Row>
              {fin && (
                <Row label="Balance transaction">
                  <span className="font-mono">{sale.stripe_balance_transaction_id ?? "—"}</span>
                </Row>
              )}
            </dl>
          </details>
        </Card>
      </div>

      <h2 className="mb-1 text-[15px] font-semibold">Reembolsos</h2>
      <p className="mb-3 text-ink-600">
        Los reembolsos se hacen en Stripe; aquí aparecen solos al procesarse.{" "}
        {paymentUrl && (
          <a href={paymentUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-gold-800 hover:underline">
            Registrar un reembolso en Stripe
          </a>
        )}
      </p>
      <div className="mb-6">
        <Table head={fin ? ["Fecha", "Monto", "IVA", "Estado", "Motivo", "ID"] : ["Fecha", "Monto", "Estado", "Motivo", "ID"]} empty={detail.refunds.length === 0 ? "Sin reembolsos." : undefined}>
          {detail.refunds.map((refund) => (
            <tr key={refund.id}>
              <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(refund.stripe_created_at, true)}</td>
              <td className="px-3 py-2.5 tabular-nums">{formatMxn(refund.amount_cents)}</td>
              {fin && <td className="px-3 py-2.5 tabular-nums">{formatMxn(refund.tax_cents)}</td>}
              <td className="px-3 py-2.5">
                <Badge tone={refund.status === "succeeded" ? "ok" : refund.status === "failed" ? "danger" : "neutral"}>{refund.status}</Badge>
              </td>
              <td className="px-3 py-2.5">{refund.reason ?? "—"}</td>
              <td className="px-3 py-2.5 font-mono text-xs">{refund.id}</td>
            </tr>
          ))}
        </Table>
      </div>

      {detail.disputes.length > 0 && (
        <>
          <h2 className="mb-2 text-[15px] font-semibold">Contracargos</h2>
          <div className="mb-6">
            <Table head={fin ? ["Abierto", "Monto", "Comisión", "Estado", "Motivo", "Cerrado", ""] : ["Abierto", "Monto", "Estado", "Motivo", "Cerrado", ""]}>
              {detail.disputes.map((dispute) => (
                <tr key={dispute.id}>
                  <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(dispute.stripe_created_at, true)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{formatMxn(dispute.amount_cents)}</td>
                  {fin && <td className="px-3 py-2.5 tabular-nums">{formatMxn(dispute.fee_cents)}</td>}
                  <td className="px-3 py-2.5">
                    <Badge tone={dispute.status === "won" ? "ok" : "danger"}>{dispute.status}</Badge>
                  </td>
                  <td className="px-3 py-2.5">{dispute.reason ?? "—"}</td>
                  <td className="px-3 py-2.5">{formatDate(dispute.closed_at, true)}</td>
                  <td className="px-3 py-2.5">
                    <a href={stripeDisputeUrl(dispute.id)} target="_blank" rel="noopener noreferrer" className="font-semibold text-gold-800 hover:underline">
                      Stripe
                    </a>
                  </td>
                </tr>
              ))}
            </Table>
          </div>
        </>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Eventos de Stripe">
          {detail.stripe_events.length === 0 ? (
            <p className="text-ink-600">Sin eventos registrados.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-xs">
              {detail.stripe_events.map((event) => (
                <li key={event.id} className="flex flex-wrap items-center gap-2">
                  <span className="text-ink-600">{formatDate(event.at, true)}</span>
                  <span className="font-mono">{event.type}</span>
                  {event.status === "anomaly" ? <Badge tone="danger">anomalía</Badge> : <Badge tone="ok">ok</Badge>}
                  {event.error && <span className="text-ink-600">{event.error}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <NotesPanel targetType="purchase" targetId={sale.id} />
      </div>
    </>
  );
}
