import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, Circle } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { version } from "@/package.json";
import { CHANGELOG } from "@/lib/changelog";
import { themeFrom } from "@/lib/theme";
import { ThemePicker } from "@/components/theme-picker";
import { AppUpdate } from "@/components/app-update";
import { requirePermission } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { getCatalog } from "@/lib/data/catalog";
import { centsToInput, formatMxn } from "@/lib/format";
import { maskId } from "@/lib/stripe-links";
import { Badge, Nil, PageTitle, SectionNav, cn, formatDate, ui, zeroClass } from "@/components/ui";
import { DataError } from "@/components/finance";
import { RuleEditor, SettingsForm } from "@/components/settings-forms";

export const metadata: Metadata = { title: "Configuración" };

/** "1600" bps → "16"; "1650" → "16.5". */
function bpsToPercent(bps: number): string {
  const text = centsToInput(bps);
  return text.replace(/\.?0+$/, "");
}

/** Categoría de ajustes al estilo Stripe/Polaris: qué es a la izquierda, el formulario a la derecha. */
function Category({ id, title, description, children }: { id: string; title: string; description: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-4 border-t border-ink-150 py-8 first:border-t-0 first:pt-0 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-10">
      <div>
        <h2 id={id} className="text-base font-semibold text-ink-950">
          {title}
        </h2>
        <div className="mt-1 flex flex-col gap-2 text-[13px] text-ink-600">{description}</div>
      </div>
      <div className="min-w-0 overflow-hidden rounded-lg border border-ink-150 bg-surface">{children}</div>
    </section>
  );
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
  const products = [...catalog.plans, ...catalog.addons];
  // Primero los que sí tienen ID de Stripe; los demás quedan plegados.
  const linked = products.filter((item) => item.stripeProductId || item.stripePriceId);
  const unlinked = products.filter((item) => !item.stripeProductId && !item.stripePriceId);
  const activeAddons = catalog.addons.filter((addon) => addon.isActive).length;
  const theme = themeFrom((await cookies()).get("theme")?.value);
  const releaseIndex = CHANGELOG.findIndex((entry) => entry.version === version);
  const release = CHANGELOG[releaseIndex];
  const previous = CHANGELOG[releaseIndex + 1];

  return (
    <>
      <PageTitle
        title="Configuración"
        subtitle={`Última modificación: ${formatDate(settings.updated_at, true)}`}
      />
      <SectionNav
        items={[
          { id: "empresa", label: "Celebraloo" },
          { id: "apartados", label: "Apartados" },
          { id: "catalogo", label: "Planes" },
          { id: "stripe", label: "Stripe" },
          { id: "apariencia", label: "Apariencia" },
          { id: "version", label: "Versión" },
        ]}
      />

      <Category
        id="empresa"
        title="Celebraloo"
        description={
          <>
            <p>Datos de la empresa, la tasa de IVA para los cálculos y cuándo un evento cuenta como Próximo.</p>
            <p>
              Moneda: <span className="font-medium text-ink-950">{settings.currency}</span> (fija).
            </p>
          </>
        }
      >
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
      </Category>

      <Category
        id="apartados"
        title="Apartados financieros"
        description={
          <p>
            El IVA cobrado siempre se aparta. Estas reglas apartan además un porcentaje (sobre la base que elijas) o un monto fijo por mes.
            Todo lo apartado se resta del dinero disponible. Se ve en Finanzas.
          </p>
        }
      >
        <div className="divide-y divide-ink-150">
          {(rules ?? []).length === 0 && <p className="px-4 py-3 text-[13px] text-ink-600">Aún no hay apartados. Agrega el primero abajo.</p>}
          {(rules ?? []).map((rule, index) => (
            <RuleEditor
              key={rule.id}
              id={rule.id}
              showLabels={index === 0}
              initial={{
                name: rule.name,
                kind: rule.kind,
                value: rule.kind === "percent" ? bpsToPercent(rule.value) : centsToInput(rule.value),
                base: rule.base ?? "ventas_sin_iva",
                isActive: rule.is_active,
              }}
            />
          ))}
        </div>
        <div className="border-t border-ink-150 bg-surface-2/50 pt-3">
          <h3 className="px-4 text-[13px] font-semibold text-ink-950">Nuevo apartado</h3>
          <RuleEditor id={null} initial={{ name: "", kind: "percent", value: "0", base: "ventas_sin_iva", isActive: true }} />
        </div>
      </Category>

      <Category
        id="catalogo"
        title="Planes y complementos"
        description={
          <>
            <p>Precios con IVA incluido y qué está a la venta hoy.</p>
            <Link href="/catalogo" className={ui.link}>
              Ver y editar en Planes
            </Link>
          </>
        }
      >
        <ul className="divide-y divide-ink-150 text-sm">
          {catalog.plans.map((plan) => (
            <li key={plan.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="font-medium text-ink-950">{plan.name}</span>
              <span className="flex items-center gap-3">
                <span className={cn("text-right tabular-nums", zeroClass(plan.priceCents, "text-ink-800"))}>{formatMxn(plan.priceCents)}</span>
                {/* Solo la excepción lleva chip (R13). */}
                {!plan.isActive && (
                  <Badge>
                    <Circle size={12} aria-hidden="true" /> Inactivo
                  </Badge>
                )}
              </span>
            </li>
          ))}
          <li className="flex items-center justify-between gap-3 bg-surface-2/50 px-4 py-2.5">
            <span className="text-ink-800">Complementos activos</span>
            <span className="font-medium tabular-nums text-ink-950">
              {activeAddons} de {catalog.addons.length}
            </span>
          </li>
        </ul>
      </Category>

      <Category
        id="stripe"
        title="Stripe"
        description={
          <>
            <p>El panel solo usa una llave restringida de Stripe para cupones; las demás llaves viven en el servidor de Celebraloo y el panel no las muestra.</p>
            <p>
              Enlaces al dashboard: <span className="font-medium text-ink-950">{stripeMode}</span>.
            </p>
          </>
        }
      >
        {linked.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-left text-[13px]">
              <caption className="sr-only">Productos y precios ligados a Stripe</caption>
              <thead className="border-b border-ink-150 bg-surface-2 text-xs text-ink-600">
                <tr>
                  <th scope="col" className="h-10 px-4 font-medium">
                    Producto
                  </th>
                  <th scope="col" className="h-10 px-3 font-medium">
                    ID de producto
                  </th>
                  <th scope="col" className="h-10 px-4 font-medium">
                    ID de precio
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-150">
                {linked.map((item) => (
                  <tr key={item.key}>
                    <td className="px-4 py-2 font-medium text-ink-950">{item.name}</td>
                    <td className="px-3 py-2 text-xs text-ink-600">
                      {item.stripeProductId ? <span className="font-mono">{maskId(item.stripeProductId)}</span> : <Nil />}
                    </td>
                    <td className="px-4 py-2 text-xs text-ink-600">
                      {item.stripePriceId ? <span className="font-mono">{maskId(item.stripePriceId)}</span> : <Nil />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-3 text-[13px] text-ink-600">Ningún plan ni complemento tiene ID de Stripe.</p>
        )}
        {unlinked.length > 0 && (
          <details className="group border-t border-ink-150 text-[13px]">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 px-4 py-2.5 font-medium text-ink-600 hover:text-ink-950 [&::-webkit-details-marker]:hidden">
              <ChevronRight size={14} aria-hidden="true" className="transition-transform duration-[var(--dur-fast)] group-open:rotate-90 motion-reduce:transition-none" />
              <span className="group-open:hidden">Mostrar {unlinked.length} sin ID de Stripe</span>
              <span className="hidden group-open:inline">Ocultar {unlinked.length} sin ID de Stripe</span>
            </summary>
            <ul className="divide-y divide-ink-150 border-t border-ink-150">
              {unlinked.map((item) => (
                <li key={item.key} className="flex items-center justify-between gap-3 px-4 py-2">
                  <span className="font-medium text-ink-950">{item.name}</span>
                  <span className="text-xs text-ink-600">Sin vincular</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Category>

      <Category id="apariencia" title="Apariencia" description={<p>Claro, oscuro o el mismo modo que tu equipo. Solo cambia cómo ves el panel en este navegador.</p>}>
        <ThemePicker initial={theme} />
      </Category>

      <Category
        id="version"
        title="Versión"
        description={
          <p>
            Versión <span className="font-medium text-ink-950 tabular-nums">{version}</span>
            {release && <> del {formatDate(release.date)}</>}.
          </p>
        }
      >
        <div className="p-4">
          <h3 className="text-[13px] font-semibold text-ink-950">{previous ? `Novedades desde la ${previous.version}` : "Novedades"}</h3>
          {release ? (
            <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-[13px] text-ink-800">
              {release.changes.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[13px] text-ink-600">Esta versión no tiene notas en lib/changelog.ts.</p>
          )}
        </div>
        <div className="border-t border-ink-150 p-4">
          <AppUpdate />
        </div>
      </Category>
    </>
  );
}
