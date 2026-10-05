import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth/require-admin";
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
  await requireSuperAdmin();
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
  const paymentUrl = stripePaymentUrl(sale.provider_payment_intent_id);
  const actionClass =
    "inline-flex h-9 items-center gap-1.5 rounded-md border border-ink-250 bg-surface px-3 font-semibold text-ink-800 hover:bg-paper";

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
          <div className="flex flex-wrap gap-2">
            {sale.profile_id && (
              <Link href={`/clientes/${sale.profile_id}`} className={actionClass}>
                Ver cliente
              </Link>
            )}
            {sale.event_id && (
              <Link href={`/eventos/${sale.event_id}`} className={actionClass}>
                Ver evento
              </Link>
            )}
            {paymentUrl && (
              <a href={paymentUrl} target="_blank" rel="noopener noreferrer" className={actionClass}>
                Abrir pago en Stripe <ExternalLink size={14} aria-hidden="true" />
              </a>
            )}
          </div>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card title="Venta">
          <dl>
            <Row label="ID interno">{sale.id}</Row>
            <Row label="Cliente">
              {detail.customer_name ? `${detail.customer_name} · ` : ""}
              {sale.email}
            </Row>
            <Row label="Evento">{detail.event_name ?? (sale.event_id ? "Evento" : "Sin evento asociado")}</Row>
            <Row label="Producto">
              {sale.item_name ?? "—"} {sale.item_type === "addon" ? "(complemento)" : sale.item_type === "plan" ? "(plan)" : ""}
            </Row>
            <Row label="Tipo de compra">
              {sale.billing_mode === "prorated_upgrade" ? "Diferencia de plan (upgrade)" : sale.checkout_intent === "upgrade" ? "Mejora" : "Normal"}
            </Row>
            <Row label="Creada">{formatDate(sale.created_at, true)}</Row>
            <Row label="Cobrada">{formatDate(sale.paid_at, true)}</Row>
            <Row label="Reclamada">{sale.claimed_at ? formatDate(sale.claimed_at, true) : "Sin reclamar"}</Row>
          </dl>
        </Card>

        <Card title="Dinero">
          <dl>
            <Row label="Subtotal">{formatMxn(sale.subtotal_cents)}</Row>
            <Row label={`IVA${sale.tax_rate_bps !== null ? ` (${sale.tax_rate_bps / 100}%)` : ""}`}>{formatMxn(sale.tax_cents)}</Row>
            <Row label="Total cobrado">{formatMxn(sale.amount_total_cents)}</Row>
            <Row label="Comisión de Stripe">{formatMxn(sale.stripe_fee_cents)}</Row>
            <Row label="Ingreso neto (Stripe)">{formatMxn(sale.net_cents)}</Row>
            <Row label="Reembolsado">{formatMxn(sale.refunded_cents)}</Row>
            <Row label="Payment Intent">{sale.provider_payment_intent_id ?? "—"}</Row>
            <Row label="Checkout Session">{sale.provider_checkout_session_id ?? "—"}</Row>
            <Row label="Cargo / balance">
              {sale.stripe_charge_id ?? "—"} · {sale.stripe_balance_transaction_id ?? "—"}
            </Row>
          </dl>
          {sale.paid_at && sale.stripe_fee_cents === null && (
            <p className="mt-3 text-xs text-gold-800">Aún sin comisión de Stripe: llega con el webhook o con el backfill.</p>
          )}
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
        <Table head={["Fecha", "Monto", "IVA", "Estado", "Motivo", "ID"]} empty={detail.refunds.length === 0 ? "Sin reembolsos." : undefined}>
          {detail.refunds.map((refund) => (
            <tr key={refund.id}>
              <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(refund.stripe_created_at, true)}</td>
              <td className="px-3 py-2.5 tabular-nums">{formatMxn(refund.amount_cents)}</td>
              <td className="px-3 py-2.5 tabular-nums">{formatMxn(refund.tax_cents)}</td>
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
            <Table head={["Abierto", "Monto", "Comisión", "Estado", "Motivo", "Cerrado", ""]}>
              {detail.disputes.map((dispute) => (
                <tr key={dispute.id}>
                  <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(dispute.stripe_created_at, true)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{formatMxn(dispute.amount_cents)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{formatMxn(dispute.fee_cents)}</td>
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
