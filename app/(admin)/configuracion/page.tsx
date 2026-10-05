import Link from "next/link";
import { requirePermission } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { getCatalog } from "@/lib/data/catalog";
import { centsToInput, formatMxn } from "@/lib/format";
import { maskId } from "@/lib/stripe-links";
import { Badge, Card, PageTitle, formatDate } from "@/components/ui";
import { DataError } from "@/components/finance";
import { RuleEditor, SettingsForm } from "@/components/settings-forms";

/** "1600" bps → "16"; "1650" → "16.5". */
function bpsToPercent(bps: number): string {
  const text = centsToInput(bps);
  return text.replace(/\.?0+$/, "");
}

export default async function SettingsPage() {
  await requirePermission("config.write");
  const supabase = await createClient();
  const [{ data: settings, error: settingsError }, { data: rules, error: rulesError }, catalog] = await Promise.all([
    supabase.from("admin_settings").select("*").eq("id", true).maybeSingle(),
    supabase.from("admin_set_aside_rules").select("*").order("sort_order").order("name"),
    getCatalog(),
  ]);
  if (settingsError || rulesError || !settings) {
    return (
      <>
        <PageTitle title="Configuración" />
        <DataError error={new Error(settingsError?.message ?? rulesError?.message ?? "Falta la fila de admin_settings (¿migración 20261001100000?).")} />
      </>
    );
  }

  const stripeMode = process.env.STRIPE_DASHBOARD_MODE?.trim() === "live" ? "Producción (live)" : "Pruebas (test)";
  const withStripe = [...catalog.plans, ...catalog.addons];

  return (
    <>
      <PageTitle
        title="Configuración"
        subtitle={`Parámetros administrativos. Cada cambio queda en Actividad. Última modificación: ${formatDate(settings.updated_at, true)}.`}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Celebraloo">
          <SettingsForm
            initial={{
              supportEmail: settings.support_email ?? "",
              companyName: settings.company_name ?? "",
              companyLegalName: settings.company_legal_name ?? "",
              companyRfc: settings.company_rfc ?? "",
              companyAddress: settings.company_address ?? "",
              ivaPercent: bpsToPercent(settings.iva_rate_bps),
              upcomingDays: String(settings.upcoming_event_days),
            }}
          />
          <p className="mt-4 border-t border-ink-150 pt-3 text-xs text-ink-600">
            Moneda: <span className="font-semibold text-ink-950">{settings.currency}</span> (fija en V1).
          </p>
        </Card>

        <Card title="Apartados financieros">
          <p className="mb-2 text-xs text-ink-600">
            El IVA cobrado siempre se aparta. Estas reglas apartan además un porcentaje (sobre la base que elijas) o un monto
            fijo por mes. Todo lo apartado se resta del dinero disponible. Se ve en Finanzas.
          </p>
          {(rules ?? []).map((rule) => (
            <RuleEditor
              key={rule.id}
              id={rule.id}
              initial={{
                name: rule.name,
                kind: rule.kind,
                value: rule.kind === "percent" ? bpsToPercent(rule.value) : centsToInput(rule.value),
                base: rule.base ?? "ventas_sin_iva",
                isActive: rule.is_active,
              }}
            />
          ))}
          <p className="mt-4 text-xs font-semibold text-ink-800">Nuevo apartado</p>
          <RuleEditor id={null} initial={{ name: "", kind: "percent", value: "0", base: "ventas_sin_iva", isActive: true }} />
        </Card>

        <Card title="Stripe">
          <p className="text-xs text-ink-600">
            Las llaves secretas de Stripe viven solo en el servidor de Celebraloo; el panel no las tiene ni las muestra.
            Enlaces al dashboard: <span className="font-semibold text-ink-950">{stripeMode}</span>.
          </p>
          <ul className="mt-3 flex flex-col gap-1.5 text-xs">
            {withStripe.map((item) => (
              <li key={item.key} className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{item.name}</span>
                <span className="font-mono text-ink-600">
                  {maskId(item.stripeProductId)} ·{" "}
                  {maskId(item.stripePriceId)}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Planes y complementos activos">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-semibold text-ink-600">Planes</p>
              <ul className="flex flex-col gap-1">
                {catalog.plans.map((plan) => (
                  <li key={plan.key} className="flex items-center justify-between gap-2">
                    <span>{plan.name}</span>
                    <span className="flex items-center gap-2 tabular-nums text-ink-800">
                      {formatMxn(plan.priceCents)}
                      {plan.isActive ? <Badge tone="ok">Activo</Badge> : <Badge>Inactivo</Badge>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-ink-600">Complementos activos</p>
              <p className="text-ink-800">
                {catalog.addons.filter((addon) => addon.isActive).length} de {catalog.addons.length}
              </p>
              <Link href="/catalogo" className="mt-2 inline-block text-xs font-semibold text-gold-800 hover:underline">
                Ver y editar en Planes
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
