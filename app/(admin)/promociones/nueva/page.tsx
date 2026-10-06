import { requirePermission } from "@/lib/auth/require-admin";
import { getCatalog } from "@/lib/data/catalog";
import { toMexicoCityLocal } from "@/lib/format";
import { stripeMode } from "@/lib/stripe/server";
import { PageTitle } from "@/components/ui";
import { PromotionForm } from "@/components/promotion-form";
import { promotionOptions } from "@/app/(admin)/promociones/options";

export default async function NewPromotionPage() {
  await requirePermission("promociones.write");
  const catalog = await getCatalog();
  const { plans, addons } = promotionOptions(catalog);
  const mode = stripeMode();

  return (
    <>
      <PageTitle
        title="Nueva promoción"
        subtitle={mode ? `Se crea en Stripe (${mode === "live" ? "producción" : "modo test"}) al guardar.` : "Falta STRIPE_SECRET_KEY en el servidor del panel."}
      />
      <PromotionForm
        id={null}
        timesRedeemed={0}
        plans={plans}
        addons={addons}
        initial={{
          kind: "cupon",
          name: "",
          code: "",
          discountType: "percent",
          value: "",
          startsAt: toMexicoCityLocal(new Date().toISOString()),
          expiresAt: "",
          maxRedemptions: "",
          plans: [],
          addons: [],
        }}
      />
    </>
  );
}
