import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { getCatalog } from "@/lib/data/catalog";
import { listPromotions } from "@/lib/data/admin";
import { centsToInput, formatInt, formatMxn, toMexicoCityLocal } from "@/lib/format";
import { stripeMode } from "@/lib/stripe/server";
import { Badge, PageTitle, formatDate, zeroClass } from "@/components/ui";
import { PromotionForm } from "@/components/promotion-form";
import { PromotionStatusAction } from "@/components/promotion-status-action";
import { PROMOTION_STATUS, promotionOptions } from "@/app/(admin)/promociones/options";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="text-[13px] text-ink-600">{label}</dt>
      <dd className="text-right text-sm text-ink-950 tabular-nums">{children}</dd>
    </div>
  );
}

export const metadata: Metadata = { title: "Promoción" };

export default async function EditPromotionPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("promociones.write");
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const { data: row } = await supabase.from("admin_promotions").select("*").eq("id", id).maybeSingle();
  if (!row) notFound();
  const catalog = await getCatalog();
  const options = promotionOptions(catalog);
  // Estado calculado y ventas: mismo RPC que la lista. Si falla, el resumen se queda con lo de la tabla.
  const summary = await listPromotions()
    .then((list) => list.find((item) => item.id === id) ?? null)
    .catch(() => null);
  const status = summary ? PROMOTION_STATUS[summary.status] : null;
  const mode = stripeMode();
  // Un plan o complemento que ya no se vende sigue apareciendo si la promoción lo incluía.
  const keep = (list: { key: string; name: string }[], selected: string[], all: { key: string; name: string }[]) => [
    ...list,
    ...all.filter((item) => selected.includes(item.key) && !list.some((option) => option.key === item.key)),
  ];

  return (
    <>
      <PageTitle
        breadcrumb={[{ href: "/promociones", label: "Promociones" }]}
        title={`Editar ${row.code}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {row.name}
            {status && (
              <Badge tone={status.tone}>
                <status.icon size={12} aria-hidden="true" />
                {status.label}
              </Badge>
            )}
          </span>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <aside aria-labelledby="promo-summary" className="rounded-lg border border-ink-150 bg-surface max-lg:order-last lg:order-2">
          <h2 id="promo-summary" className="border-b border-ink-150 px-4 py-3 text-base font-semibold text-ink-950">
            Resumen
          </h2>
          <dl className="divide-y divide-ink-150 px-4 py-1">
            <Row label="Usos">
              <span className={zeroClass(row.times_redeemed)}>{formatInt(row.times_redeemed)}</span>
              {row.max_redemptions ? ` / ${formatInt(row.max_redemptions)}` : " (sin límite)"}
            </Row>
            {summary && (
              <>
                <Row label="Ventas con descuento"><span className={zeroClass(summary.ventas)}>{formatInt(summary.ventas)}</span></Row>
                <Row label="Descuento otorgado"><span className={zeroClass(summary.descuento_total_cents)}>{formatMxn(summary.descuento_total_cents)}</span></Row>
                <Row label="Cobrado en esas ventas"><span className={zeroClass(summary.cobrado_cents)}>{formatMxn(summary.cobrado_cents)}</span></Row>
              </>
            )}
            {row.times_redeemed_synced_at && <Row label="Usos sincronizados">{formatDate(row.times_redeemed_synced_at, true)}</Row>}
            <Row label="Creada">{formatDate(row.created_at)}</Row>
          </dl>
          {mode && (
            <div className="border-t border-ink-150 px-4 py-3">
              <PromotionStatusAction id={row.id} active={row.is_active} />
            </div>
          )}
        </aside>
        <div className="min-w-0 lg:order-1">
          <PromotionForm
            id={row.id}
            timesRedeemed={row.times_redeemed}
            plans={keep(options.plans, row.applies_to_plans, catalog.plans)}
            addons={keep(options.addons, row.applies_to_addons, catalog.addons)}
            initial={{
              kind: row.kind,
              name: row.name,
              code: row.code,
              discountType: row.discount_type,
              value: row.discount_type === "percent" ? String(Number(row.percent_off)) : centsToInput(row.amount_off_cents),
              startsAt: toMexicoCityLocal(row.starts_at),
              expiresAt: toMexicoCityLocal(row.expires_at),
              maxRedemptions: row.max_redemptions ? String(row.max_redemptions) : "",
              plans: row.applies_to_plans,
              addons: row.applies_to_addons,
            }}
          />
        </div>
      </div>
    </>
  );
}
