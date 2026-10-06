import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { getCatalog } from "@/lib/data/catalog";
import { centsToInput, toMexicoCityLocal } from "@/lib/format";
import { PageTitle } from "@/components/ui";
import { PromotionForm } from "@/components/promotion-form";
import { promotionOptions } from "@/app/(admin)/promociones/options";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditPromotionPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("promociones.write");
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const { data: row } = await supabase.from("admin_promotions").select("*").eq("id", id).maybeSingle();
  if (!row) notFound();
  const catalog = await getCatalog();
  const options = promotionOptions(catalog);
  // Un plan o complemento que ya no se vende sigue apareciendo si la promoción lo incluía.
  const keep = (list: { key: string; name: string }[], selected: string[], all: { key: string; name: string }[]) => [
    ...list,
    ...all.filter((item) => selected.includes(item.key) && !list.some((option) => option.key === item.key)),
  ];

  return (
    <>
      <PageTitle title={`Editar ${row.code}`} subtitle={row.name} />
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
    </>
  );
}
