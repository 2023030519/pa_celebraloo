import type { Metadata } from "next";
import Link from "next/link";
import { Plus, TriangleAlert } from "lucide-react";
import { can, requirePermission } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { listPromotions, type PromotionRow } from "@/lib/data/admin";
import { getCatalog } from "@/lib/data/catalog";
import { stripeMode } from "@/lib/stripe/server";
import { syncPromotionsFromStripe } from "@/lib/stripe/sync-promotions";
import { formatBps, formatInt, formatMxn, PROMOTION_KIND } from "@/lib/format";
import { Badge, HowCalculated, Nil, PageTitle, Table, cn, formatDate, ui, zeroClass } from "@/components/ui";
import { DataError } from "@/components/finance";
import { Figure, FigureRow, FigureStrip } from "@/components/kpi";
import { PROMOTION_STATUS } from "@/app/(admin)/promociones/options";

function discountLabel(row: PromotionRow): string {
  return row.discount_type === "percent" ? `${Number(row.percent_off)} %` : formatMxn(row.amount_off_cents);
}

export const metadata: Metadata = { title: "Promociones" };

export default async function PromotionsPage() {
  const admin = await requirePermission("promociones.read");
  const editable = can(admin, "promociones.write");
  const mode = stripeMode();

  // Usos al día: se consulta Stripe al abrir (a lo más cada 2 minutos por código).
  // Con service role, como el cron: lo que se escribe viene de Stripe, no de quien abre
  // (admin_sync_promotion ya no acepta sesiones de usuario, migración 20261107320000).
  let syncErrors: string[] = [];
  if (mode) {
    ({ errors: syncErrors } = await syncPromotionsFromStripe(createServiceRoleClient(), 2 * 60 * 1000));
  }

  let rows: PromotionRow[];
  try {
    rows = await listPromotions();
  } catch (error) {
    return (
      <>
        <PageTitle title="Promociones" />
        <DataError error={error} />
      </>
    );
  }
  const catalog = await getCatalog();
  const itemName = new Map([...catalog.plans, ...catalog.addons].map((item) => [item.key, item.name]));
  const active = rows.filter((row) => row.status === "activa").length;
  const sales = rows.reduce((sum, row) => sum + row.ventas, 0);
  const discount = rows.reduce((sum, row) => sum + row.descuento_total_cents, 0);
  const charged = rows.reduce((sum, row) => sum + row.cobrado_cents, 0);

  const canEdit = editable && Boolean(mode);

  return (
    <>
      <PageTitle
        title="Promociones"
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            Cupones, descuentos y promociones de lanzamiento
            {/* Producción es lo normal (neutro); modo test es lo que hay que notar. */}
            {mode && <Badge tone={mode === "live" ? "neutral" : "info"}>Stripe {mode === "live" ? "en producción" : "modo test"}</Badge>}
          </span>
        }
        primaryAction={
          canEdit && (
            <Link href="/promociones/nueva" className={ui.buttonPrimary}>
              <Plus size={16} aria-hidden="true" /> Nueva promoción
            </Link>
          )
        }
      />

      {!mode && (
        <p role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-warn-300 bg-warn-100 px-3 py-2.5 text-sm text-warn-700">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          Stripe no está conectado al panel: no se pueden crear ni sincronizar cupones. Pide a desarrollo que configure la llave.
        </p>
      )}
      {syncErrors.length > 0 && (
        <p role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-warn-300 bg-warn-100 px-3 py-2.5 text-sm text-warn-700">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          No se pudieron sincronizar algunos códigos con Stripe: {syncErrors.join(" · ")}
        </p>
      )}

      {rows.length === 0 ? (
        <section className="rounded-lg border border-ink-150 bg-surface px-4 py-12 text-center">
          <h2 className="text-base font-semibold text-ink-950">Aún no hay promociones.</h2>
          <p className="mt-1 text-sm text-ink-600">Crea un código y el cliente lo escribe al pagar.</p>
          {canEdit && (
            <Link href="/promociones/nueva" className={cn(ui.buttonPrimary, "mt-4")}>
              <Plus size={16} aria-hidden="true" /> Nueva promoción
            </Link>
          )}
        </section>
      ) : (
        <>
          <h2 className="sr-only">Cifras de promociones</h2>
          <div className="mb-6">
            <FigureStrip>
              <FigureRow cols={4} label="Cifras de promociones">
                <Figure size="md" label="Promociones activas" value={formatInt(active)} />
                <Figure size="md" label="Ventas con descuento" value={formatInt(sales)} />
                <Figure size="md" label="Descuento otorgado" value={formatMxn(discount)} />
                <Figure size="md" label="Cobrado" value={formatMxn(charged)} hint="En las ventas con descuento." />
              </FigureRow>
            </FigureStrip>
          </div>

          <h2 className="sr-only">Lista de promociones</h2>
          <Table
            head={[
              "Código",
              "Tipo",
              <span key="d" className="block text-right">
                Descuento
              </span>,
              "Vigencia",
              <span key="u" className="block text-right">
                Usos
              </span>,
              "Aplica a",
              <span key="v" className="block text-right">
                Ventas
              </span>,
              "Estado",
            ]}
            // Bajo sm: código (con su nombre), descuento y estado (R9).
            mobileHide={[1, 3, 4, 5, 6]}
            mobileCards
          >
            {rows.map((row) => {
              const status = PROMOTION_STATUS[row.status];
              const items = [...row.applies_to_plans, ...row.applies_to_addons].map((key) => itemName.get(key) ?? key);
              return (
                <tr key={row.id} className="align-top max-sm:relative">
                  <td className="px-3 py-2.5">
                    {canEdit ? (
                      <Link
                        href={`/promociones/${row.id}`}
                        // M2: en móvil toda la tarjeta abre la promoción.
                        className="font-mono font-semibold text-ink-950 underline-offset-[3px] hover:text-gold-800 hover:underline max-sm:after:absolute max-sm:after:inset-0"
                      >
                        {row.code}
                      </Link>
                    ) : (
                      <span className="font-mono font-semibold text-ink-950">{row.code}</span>
                    )}
                    <p className="text-xs text-ink-600">{row.name}</p>
                  </td>
                  <td className="px-3 py-2.5">{PROMOTION_KIND[row.kind] ?? row.kind}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{discountLabel(row)}</td>
                  <td className="px-3 py-2.5 text-xs">
                    <span className="block whitespace-nowrap">Desde {formatDate(row.starts_at, true)}</span>
                    <span className="block whitespace-nowrap text-ink-600">
                      {row.expires_at ? `Hasta ${formatDate(row.expires_at, true)}` : "Sin fecha de fin"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    <span className={zeroClass(row.times_redeemed)}>{formatInt(row.times_redeemed)}</span>
                    {row.max_redemptions ? ` / ${formatInt(row.max_redemptions)}` : ""}
                    {row.max_redemptions ? (
                      <span className="block text-xs text-ink-600">
                        {formatBps(Math.round((row.times_redeemed * 10000) / row.max_redemptions))}
                      </span>
                    ) : null}
                  </td>
                  <td className="max-w-56 px-3 py-2.5 text-xs text-ink-800">{items.length ? items.join(", ") : <Nil />}</td>
                  <td className={cn("px-3 py-2.5 text-right tabular-nums", zeroClass(row.ventas))}>
                    {formatInt(row.ventas)}
                    {row.ventas > 0 && <span className="block text-xs text-ink-600">−{formatMxn(row.descuento_total_cents)}</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      <Badge tone={status.tone}>
                        <status.icon size={12} aria-hidden="true" />
                        {status.label}
                      </Badge>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
          <HowCalculated>
            <p>Stripe es la fuente de verdad: el cliente escribe el código al pagar.</p>
            <p>
              Usos sincronizados desde Stripe. Ventas = compras pagadas con el código (sin staff); el descuento ya está restado de los ingresos.
            </p>
          </HowCalculated>
        </>
      )}
    </>
  );
}
