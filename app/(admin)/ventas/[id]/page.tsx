import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AlertTriangle, ChevronRight, CircleCheck, CircleX, Clock, ExternalLink, Info, Undo2 } from "lucide-react";
import { requirePermission } from "@/lib/auth/require-admin";
import { getSaleDetail } from "@/lib/data/admin";
import { formatMxn } from "@/lib/format";
import { stripeDisputeUrl, stripePaymentUrl } from "@/lib/stripe-links";
import { Badge, Email, Nil, PageTitle, SectionNav, Table, cn, formatDate, type Tone, ui, zeroClass } from "@/components/ui";
import { DataError, PaymentStatusBadge } from "@/components/finance";
import { NotesPanel } from "@/components/notes-panel";

export const metadata: Metadata = { title: "Venta" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Estados de Stripe en español; lo desconocido se muestra tal cual.
const REFUND_STATUS: Record<string, [string, Tone]> = {
  succeeded: ["Exitoso", "ok"],
  pending: ["Pendiente", "neutral"],
  requires_action: ["Requiere acción", "warn"],
  failed: ["Fallido", "danger"],
  canceled: ["Cancelado", "neutral"],
};
const DISPUTE_STATUS: Record<string, [string, Tone]> = {
  won: ["Ganado", "ok"],
  lost: ["Perdido", "danger"],
  needs_response: ["Requiere respuesta", "danger"],
  under_review: ["En revisión", "warn"],
  warning_needs_response: ["Aviso: requiere respuesta", "warn"],
  warning_under_review: ["Aviso en revisión", "warn"],
  warning_closed: ["Aviso cerrado", "neutral"],
};
const TONE_ICON = { ok: CircleCheck, danger: CircleX, warn: AlertTriangle, neutral: Clock, info: Info, gold: Info } as const;

function StatusBadge({ map, status }: { map: Record<string, [string, Tone]>; status: string }) {
  const [label, tone] = map[status] ?? [status, "neutral"];
  const Icon = TONE_ICON[tone];
  return (
    <Badge tone={tone}>
      <Icon size={12} aria-hidden="true" />
      {label}
    </Badge>
  );
}

/** stacked: etiqueta arriba y valor abajo, para correos e IDs que no caben a la derecha sin partirse. */
function Row({ label, children, strong, stacked }: { label: ReactNode; children: ReactNode; strong?: boolean; stacked?: boolean }) {
  return (
    <div className={cn(stacked ? "flex flex-col gap-0.5 py-2" : "flex items-baseline justify-between gap-4 py-2", strong && "font-semibold text-ink-950")}>
      <dt className={strong ? undefined : "text-ink-600"}>{label}</dt>
      <dd className={cn("min-w-0 break-words tabular-nums", !stacked && "text-right", !strong && "font-medium text-ink-950")}>{children}</dd>
    </div>
  );
}

function Section({ title, id, action, children }: { title: string; id: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-lg border border-ink-150 bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-ink-150 px-4 py-3">
        <h2 id={id} className="text-base font-semibold text-ink-950">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const money = "px-3 py-2.5 text-right tabular-nums";
const right = (text: string) => <span className="block text-right">{text}</span>;

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
  const mono = "font-mono text-xs font-normal";

  return (
    <>
      <PageTitle
        breadcrumb={[{ href: "/ventas", label: "Ventas" }]}
        title={`${sale.item_name ?? "Venta"} · ${formatMxn(sale.amount_total_cents)}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <PaymentStatusBadge status={sale.display_status} />
            <span>{formatDate(sale.paid_at ?? sale.created_at, true)}</span>
            <span aria-hidden="true">·</span>
            <span>IVA incluido</span>
            {detail.has_failed_attempt && (
              <Badge tone="danger">
                <CircleX size={12} aria-hidden="true" />
                Tuvo intentos rechazados
              </Badge>
            )}
          </span>
        }
        actions={
          paymentUrl && (
            <a href={paymentUrl} target="_blank" rel="noopener noreferrer" className={ui.buttonSecondary}>
              Abrir pago en Stripe <ExternalLink size={14} aria-hidden="true" />
            </a>
          )
        }
      />
      <SectionNav
        items={[
          { id: "resumen", label: "Resumen" },
          { id: "dinero", label: "Dinero" },
          { id: "reembolsos", label: "Reembolsos" },
          ...(detail.disputes.length > 0 ? [{ id: "contracargos", label: "Contracargos" }] : []),
          { id: "eventos-stripe", label: "Stripe" },
          { id: "notas", label: "Notas" },
        ]}
      />

      {(detail.is_staff || refund) && (
        <div className="mb-6 flex flex-col gap-2">
          {detail.is_staff && (
            <p role="note" className="flex items-start gap-2 rounded-lg border border-info-300 bg-info-100 px-4 py-3 text-sm text-info-700">
              <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
              Compra de una cuenta de staff: no cuenta en Ventas, Finanzas ni Reportes.
            </p>
          )}
          {refund && (
            <p role="note" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-info-300 bg-info-100 px-4 py-3 text-sm text-info-700">
              <span className="flex items-center gap-1.5 font-semibold">
                <Undo2 size={16} aria-hidden="true" />
                Reembolso {refund.kind === "total" ? "total" : "parcial"}
              </span>
              <span className="tabular-nums">
                {formatMxn(refund.refunded_cents)} de {formatMxn(sale.amount_total_cents)}
              </span>
              <span>{formatDate(refund.last_refund_at, true)}</span>
            </p>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Lateral: resumen y notas. En móvil el resumen va arriba y las notas al final; en escritorio, a la derecha. */}
        <aside className="flex flex-col gap-6 max-lg:contents lg:order-last">
          <Section title="Resumen" id="resumen">
            <dl className="divide-y divide-ink-150 px-4 py-1 text-sm">
              <Row label="Cliente" stacked>
                {customerId ? (
                  <Link href={`/clientes/${customerId}`} className={ui.link}>
                    {detail.customer_name ?? <Email value={sale.email} />}
                  </Link>
                ) : (
                  <Email value={sale.email} />
                )}
                {detail.customer_name && <Email value={sale.email} className="text-xs font-normal text-ink-600" />}
                {!customerId && <span className="block text-xs font-normal text-ink-600">Aún no tiene cuenta</span>}
              </Row>
              <Row label="Evento">
                {sale.event_id ? (
                  <Link href={`/eventos/${sale.event_id}`} className={ui.link}>
                    {detail.event_name ?? "Evento"}
                  </Link>
                ) : (
                  <span className="font-normal text-ink-600">{sale.claimed_at ? "Sin evento asociado" : "Sin reclamar todavía"}</span>
                )}
              </Row>
              <Row label="Producto">
                {sale.item_name ?? <Nil />}
                {(sale.item_type === "addon" || sale.item_type === "plan") && (
                  <span className="block text-xs font-normal text-ink-600">{sale.item_type === "addon" ? "Complemento" : "Plan"}</span>
                )}
              </Row>
              <Row label="Tipo de compra">
                {sale.billing_mode === "prorated_upgrade" ? "Diferencia de plan (mejora)" : sale.checkout_intent === "upgrade" ? "Mejora" : "Normal"}
              </Row>
              <Row label="Fecha de pago">{sale.paid_at ? formatDate(sale.paid_at, true) : "Sin cobrar"}</Row>
              <Row label="Reclamada">{sale.claimed_at ? formatDate(sale.claimed_at, true) : "Sin reclamar"}</Row>
              <Row label="ID de pago (Stripe)" stacked>
                <span className={mono}>{sale.provider_payment_intent_id ?? <Nil />}</span>
              </Row>
            </dl>
            <details className="group border-t border-ink-150 px-4 py-3 text-xs text-ink-600">
              <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 font-medium text-ink-800 max-md:-my-3 max-md:min-h-11 [&::-webkit-details-marker]:hidden">
                Identificadores técnicos
                <ChevronRight size={14} aria-hidden="true" className="transition-transform duration-[var(--dur-fast)] group-open:rotate-90 motion-reduce:transition-none" />
              </summary>
              <dl className="mt-2 divide-y divide-ink-150">
                <Row label="ID interno" stacked>
                  <span className={mono}>{sale.id}</span>
                </Row>
                <Row label="Checkout Session" stacked>
                  <span className={mono}>{sale.provider_checkout_session_id ?? <Nil />}</span>
                </Row>
                <Row label="Cargo" stacked>
                  <span className={mono}>{sale.stripe_charge_id ?? <Nil />}</span>
                </Row>
                {fin && (
                  <Row label="Balance transaction" stacked>
                    <span className={mono}>{sale.stripe_balance_transaction_id ?? <Nil />}</span>
                  </Row>
                )}
              </dl>
            </details>
          </Section>
          <div id="notas" className="max-lg:order-last">
            <NotesPanel targetType="purchase" targetId={sale.id} />
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          <Section title="Dinero" id="dinero">
            <dl className="divide-y divide-ink-150 px-4 py-1 text-sm">
              {detail.discount && (
                <>
                  <Row label="Precio de lista">{formatMxn(detail.discount.list_amount_cents)}</Row>
                  <Row label={`Descuento${detail.discount.promotion_code ? ` (${detail.discount.promotion_code})` : ""}`}>
                    −{formatMxn(detail.discount.discount_cents)}
                  </Row>
                </>
              )}
              {fin && <Row label="Subtotal (sin IVA)">{formatMxn(sale.subtotal_cents)}</Row>}
              {fin && <Row label={`IVA${sale.tax_rate_bps != null ? ` (${sale.tax_rate_bps / 100}%)` : ""}`}><span className={zeroClass(sale.tax_cents)}>{formatMxn(sale.tax_cents)}</span></Row>}
              <Row
                strong
                label={
                  <>
                    {sale.paid_at ? "Total cobrado" : "Total (sin cobrar)"}
                    <span className="ml-1.5 text-xs font-normal text-ink-600">IVA incluido</span>
                  </>
                }
              >
                {formatMxn(sale.amount_total_cents)}
              </Row>
              {fin && (
                <Row label="Comisión de Stripe">
                  {sale.stripe_fee_cents === null ? <Nil /> : `−${formatMxn(sale.stripe_fee_cents)}`}
                </Row>
              )}
              {fin && (
                <Row strong label="Neto">
                  {sale.net_cents === null ? <Nil /> : formatMxn(sale.net_cents)}
                </Row>
              )}
              <Row label="Reembolsado">
                {refund ? `−${formatMxn(refund.refunded_cents)} (${refund.kind === "total" ? "total" : "parcial"})` : <span className="text-ink-400">{formatMxn(0)}</span>}
              </Row>
            </dl>
            {!fin && <p className="border-t border-ink-150 px-4 py-3 text-xs text-ink-600">Tu rol no ve el desglose financiero (subtotal, IVA, comisión y neto).</p>}
            {fin && sale.paid_at && sale.stripe_fee_cents === null && (
              <p className="flex items-start gap-1.5 border-t border-ink-150 px-4 py-3 text-xs text-warn-700">
                <AlertTriangle size={14} aria-hidden="true" className="mt-px shrink-0" />
                Aún sin comisión de Stripe: llega con el webhook o con el backfill.
              </p>
            )}
          </Section>

          <div id="reembolsos">
            <Table
              title="Reembolsos"
              aside={
                paymentUrl && (
                  <a href={paymentUrl} target="_blank" rel="noopener noreferrer" className={cn(ui.link, "inline-flex items-center gap-1 text-[13px] max-md:-my-3 max-md:min-h-11")}>
                    Registrar un reembolso en Stripe <ExternalLink size={13} aria-hidden="true" />
                  </a>
                )
              }
              head={fin ? ["Fecha", right("Monto"), right("IVA"), "Estado", "Motivo", "ID"] : ["Fecha", right("Monto"), "Estado", "Motivo", "ID"]}
              mobileHide={fin ? [2, 4, 5] : [3, 4]}
              mobileCards
              empty={detail.refunds.length === 0 ? "Sin reembolsos. Se hacen en Stripe y aquí aparecen solos al procesarse." : undefined}
            >
              {detail.refunds.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2.5 whitespace-nowrap text-ink-600">{formatDate(item.stripe_created_at, true)}</td>
                  <td className={cn(money, zeroClass(item.amount_cents))}>{formatMxn(item.amount_cents)}</td>
                  {fin && <td className={cn(money, zeroClass(item.tax_cents))}>{formatMxn(item.tax_cents)}</td>}
                  <td className="px-3 py-2.5">
                    <StatusBadge map={REFUND_STATUS} status={item.status} />
                  </td>
                  <td className="px-3 py-2.5">{item.reason ?? <Nil label="Sin motivo" />}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-ink-600">
                    <span className="block max-w-48 truncate" title={item.id}>
                      {item.id}
                    </span>
                  </td>
                </tr>
              ))}
            </Table>
          </div>

          {detail.disputes.length > 0 && (
            <div id="contracargos">
              <Table
                title="Contracargos"
                head={
                  fin
                    ? ["Abierto", right("Monto"), right("Comisión"), "Estado", "Motivo", "Cerrado", <span key="stripe" className="sr-only">Stripe</span>]
                    : ["Abierto", right("Monto"), "Estado", "Motivo", "Cerrado", <span key="stripe" className="sr-only">Stripe</span>]
                }
                mobileHide={fin ? [2, 4, 5] : [3, 4]}
                mobileCards
              >
                {detail.disputes.map((dispute) => (
                  <tr key={dispute.id}>
                    <td className="px-3 py-2.5 whitespace-nowrap text-ink-600">{formatDate(dispute.stripe_created_at, true)}</td>
                    <td className={cn(money, zeroClass(dispute.amount_cents))}>{formatMxn(dispute.amount_cents)}</td>
                    {fin && <td className={cn(money, zeroClass(dispute.fee_cents))}>{formatMxn(dispute.fee_cents)}</td>}
                    <td className="px-3 py-2.5">
                      <StatusBadge map={DISPUTE_STATUS} status={dispute.status} />
                    </td>
                    <td className="px-3 py-2.5">{dispute.reason ?? <Nil label="Sin motivo" />}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-ink-600">{dispute.closed_at ? formatDate(dispute.closed_at, true) : "Sin cerrar"}</td>
                    <td className="px-3 py-2.5">
                      <a
                        href={stripeDisputeUrl(dispute.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(ui.link, "inline-flex items-center gap-1 text-[13px] max-md:min-h-11")}
                      >
                        Ver en Stripe <ExternalLink size={13} aria-hidden="true" />
                      </a>
                    </td>
                  </tr>
                ))}
              </Table>
            </div>
          )}

          <Section title="Eventos de Stripe" id="eventos-stripe">
            {detail.stripe_events.length === 0 ? (
              <p className="px-4 py-3 text-sm text-ink-600">Sin eventos registrados.</p>
            ) : (
              <ul className="divide-y divide-ink-150 text-xs">
                {detail.stripe_events.map((event) => (
                  <li key={event.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                    <span className="whitespace-nowrap text-ink-600">{formatDate(event.at, true)}</span>
                    <span className="min-w-0 font-mono break-words text-ink-950">{event.type}</span>
                    {/* R22: solo la anomalía lleva chip; un evento correcto es lo normal. */}
                    {event.status === "anomaly" && (
                      <Badge tone="danger">
                        <AlertTriangle size={12} aria-hidden="true" />
                        Anomalía
                      </Badge>
                    )}
                    {event.error && <span className="basis-full text-ink-600">{event.error}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
