import Link from "next/link";
import { CalendarClock, CircleCheck, CircleSlash, Plus, TriangleAlert } from "lucide-react";
import { can, requirePermission } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { listPromotions, type PromotionRow, type PromotionStatus } from "@/lib/data/admin";
import { getCatalog } from "@/lib/data/catalog";
import { stripeMode } from "@/lib/stripe/server";
import { syncPromotionsFromStripe } from "@/lib/stripe/sync-promotions";
import { formatBps, formatInt, formatMxn, PROMOTION_KIND } from "@/lib/format";
import { Badge, PageTitle, Table, formatDate, type Tone } from "@/components/ui";
import { DataError } from "@/components/finance";
import { KpiTile } from "@/components/kpi";
import { PromotionStatusAction } from "@/components/promotion-status-action";

const STATUS: Record<PromotionStatus, { label: string; tone: Tone; icon: typeof CircleCheck }> = {
  activa: { label: "Activa", tone: "ok", icon: CircleCheck },
  programada: { label: "Programada", tone: "info", icon: CalendarClock },
  vencida: { label: "Vencida", tone: "neutral", icon: CircleSlash },
  agotada: { label: "Agotada", tone: "warn", icon: CircleSlash },
  inactiva: { label: "Inactiva", tone: "neutral", icon: CircleSlash },
};

function discountLabel(row: PromotionRow): string {
  return row.discount_type === "percent" ? `${Number(row.percent_off)} %` : formatMxn(row.amount_off_cents);
}

export default async function PromotionsPage() {
  const admin = await requirePermission("promociones.read");
  const editable = can(admin, "promociones.write");
  const mode = stripeMode();

  // Usos al día: se consulta Stripe al abrir (a lo más cada 2 minutos por código).
  let syncErrors: string[] = [];
  if (mode) {
    const supabase = await createClient();
    ({ errors: syncErrors } = await syncPromotionsFromStripe(supabase, 2 * 60 * 1000));
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

  return (
    <>
      <PageTitle
        title="Promociones"
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            Cupones, descuentos y promociones de lanzamiento. Stripe es la fuente de verdad: el cliente escribe el código al pagar.
            {mode && <Badge tone={mode === "live" ? "danger" : "info"}>Stripe {mode === "live" ? "en producción" : "modo test"}</Badge>}
          </span>
        }
        actions={
          editable &&
          mode && (
            <Link
              href="/promociones/nueva"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-ink-950 px-4 font-semibold text-surface hover:bg-ink-800"
            >
              <Plus size={16} aria-hidden="true" /> Nueva promoción
            </Link>
          )
        }
      />

      {!mode && (
        <p role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-warn-300 bg-warn-100 px-3 py-2 text-warn-700">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          Falta STRIPE_SECRET_KEY en el servidor del panel: sin ella no se pueden crear ni sincronizar cupones.
        </p>
      )}
      {syncErrors.length > 0 && (
        <p role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-warn-300 bg-warn-100 px-3 py-2 text-xs text-warn-700">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          No se pudieron sincronizar algunos códigos con Stripe: {syncErrors.join(" · ")}
        </p>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiTile size="md" label="Promociones activas" value={formatInt(active)} />
        <KpiTile size="md" label="Ventas con descuento" value={formatInt(sales)} />
        <KpiTile size="md" label="Descuento otorgado" value={formatMxn(discount)} />
        <KpiTile size="md" label="Cobrado en esas ventas" value={formatMxn(charged)} />
      </div>

      <Table
        head={["Código", "Tipo", "Descuento", "Vigencia", "Usos", "Aplica a", "Ventas", "Estado", ""]}
        empty={rows.length === 0 ? "Aún no hay promociones." : undefined}
      >
        {rows.map((row) => {
          const status = STATUS[row.status];
          const items = [...row.applies_to_plans, ...row.applies_to_addons].map((key) => itemName.get(key) ?? key);
          return (
            <tr key={row.id} className="align-top hover:bg-paper">
              <td className="px-3 py-2.5">
                <span className="font-mono font-semibold">{row.code}</span>
                <p className="text-xs text-ink-600">{row.name}</p>
              </td>
              <td className="px-3 py-2.5">{PROMOTION_KIND[row.kind] ?? row.kind}</td>
              <td className="px-3 py-2.5 tabular-nums">{discountLabel(row)}</td>
              <td className="px-3 py-2.5 text-xs">
                <span className="block whitespace-nowrap">Desde {formatDate(row.starts_at, true)}</span>
                <span className="block whitespace-nowrap text-ink-600">{row.expires_at ? `Hasta ${formatDate(row.expires_at, true)}` : "Sin fecha de fin"}</span>
              </td>
              <td className="px-3 py-2.5 tabular-nums">
                {formatInt(row.times_redeemed)}
                {row.max_redemptions ? ` / ${formatInt(row.max_redemptions)}` : ""}
                {row.max_redemptions ? (
                  <span className="block text-xs text-ink-600">{formatBps(Math.round((row.times_redeemed * 10000) / row.max_redemptions))}</span>
                ) : null}
              </td>
              <td className="px-3 py-2.5 text-xs">{items.join(", ")}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {formatInt(row.ventas)}
                {row.ventas > 0 && <span className="block text-xs text-ink-600">−{formatMxn(row.descuento_total_cents)}</span>}
              </td>
              <td className="px-3 py-2.5">
                <Badge tone={status.tone}>
                  <status.icon size={11} className="mr-1" aria-hidden="true" />
                  {status.label}
                </Badge>
              </td>
              <td className="px-3 py-2.5">
                {editable && mode && (
                  <span className="flex flex-col items-start gap-2">
                    <Link href={`/promociones/${row.id}`} className="text-xs font-semibold text-gold-800 hover:underline">
                      Editar
                    </Link>
                    <PromotionStatusAction id={row.id} active={row.is_active} />
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </Table>
      <p className="mt-2 text-xs text-ink-600">
        Usos sincronizados desde Stripe. Ventas = compras pagadas con el código (sin staff); el descuento ya está restado de los ingresos.
      </p>
    </>
  );
}
