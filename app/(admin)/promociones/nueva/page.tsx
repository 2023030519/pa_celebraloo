import type { Metadata } from "next";
import { TriangleAlert } from "lucide-react";
import { requirePermission } from "@/lib/auth/require-admin";
import { getCatalog } from "@/lib/data/catalog";
import { toMexicoCityLocal } from "@/lib/format";
import { stripeMode } from "@/lib/stripe/server";
import { PageTitle } from "@/components/ui";
import { PromotionForm } from "@/components/promotion-form";
import { promotionOptions } from "@/app/(admin)/promociones/options";

export const metadata: Metadata = { title: "Nueva promoción" };

export default async function NewPromotionPage() {
  await requirePermission("promociones.write");
  const catalog = await getCatalog();
  const { plans, addons } = promotionOptions(catalog);
  const mode = stripeMode();

  return (
    <>
      <PageTitle
        breadcrumb={[{ href: "/promociones", label: "Promociones" }]}
        title="Nueva promoción"
        subtitle={mode ? `Se crea en Stripe (${mode === "live" ? "producción" : "modo test"}) al guardar.` : "El cliente escribe el código al pagar."}
      />
      {!mode && (
        <p role="alert" className="mb-4 flex max-w-3xl items-start gap-2 rounded-lg border border-warn-300 bg-warn-100 px-3 py-2.5 text-sm text-warn-700">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          Stripe no está conectado al panel: no se pueden crear cupones. Pide a desarrollo que configure la llave.
        </p>
      )}
      <PromotionForm
        disabled={!mode}
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
