import "server-only";
import { ChevronRight, CircleSlash } from "lucide-react";
import { getCatalogOverview, type CatalogOverviewRow } from "@/lib/data/admin";
import { formatValue, type Catalog } from "@/lib/data/catalog";
import { formatMxn } from "@/lib/format";
import { maskId } from "@/lib/stripe-links";
import { Badge, HowCalculated, Nil, Table, cn, zeroClass } from "@/components/ui";
import { DataError } from "@/components/finance";

/** Encabezado de columna numérica: alineado a la derecha como sus celdas. */
export const rightHead = (text: string) => <span className="block text-right">{text}</span>;

/** R22: si casi todo está inactivo, lo inactivo es lo normal y se marca lo activo. */
export const mostlyInactive = (list: { active: boolean }[]) => list.filter((row) => !row.active).length * 2 > list.length;

/** Solo se marca la excepción (R13, R22); el estado normal queda en texto para lectores de pantalla. */
export function ActiveBadge({ active, markActive = false }: { active: boolean; markActive?: boolean }) {
  if (markActive && active) return <Badge tone="ok">Activo</Badge>;
  if (!markActive && !active)
    return (
      <Badge>
        <CircleSlash size={12} aria-hidden="true" />
        Inactivo
      </Badge>
    );
  return <span className="sr-only">{active ? "Activo" : "Inactivo"}</span>;
}

/**
 * Resumen comercial de Planes (sección 9 del brief), solo lectura. Ventas e
 * ingresos (lo cobrado) salen de admin_catalog_overview; el precio de un
 * paquete, del catálogo (plan_prices vigente: lo que cobra el checkout, no
 * plans.price_cents que trae el RPC); funciones y límites, de capabilities.
 */
export async function CatalogOverview({ catalog }: { catalog: Catalog }) {
  let rows: CatalogOverviewRow[];
  try {
    rows = await getCatalogOverview();
  } catch (error) {
    return (
      <section id="resumen" aria-labelledby="resumen-title" className="mb-10 scroll-mt-6">
        <h2 id="resumen-title" className="mb-3 text-base font-semibold text-ink-950">
          Resumen comercial
        </h2>
        <DataError error={error} />
      </section>
    );
  }
  const capabilityName = new Map(catalog.capabilities.map((cap) => [cap.key, cap.name]));
  const itemsByKey = new Map([...catalog.plans, ...catalog.addons].map((item) => [item.key, item]));
  const rate = rows[0]?.tax_rate_bps ?? 1600;

  const head = [
    "Nombre",
    rightHead("Precio con IVA"),
    rightHead(`Sin IVA (${rate / 100}%)`),
    "Estado",
    "Funciones y límites",
    "Stripe",
    rightHead("Ventas"),
    rightHead("Cobrado neto"),
  ];
  // Bajo sm solo Nombre, Precio con IVA y Estado: lo demás se oculta, sin scroll ni encabezados cortados.
  const mobileHide = head.map((_, index) => index).filter((index) => ![0, 1, 3].includes(index));

  const section = (kind: "plan" | "addon", title: string) => {
    const list = rows.filter((row) => row.item_type === kind);
    const markActive = mostlyInactive(list.map((row) => ({ active: row.is_active })));
    return (
      <>
        <h3 className="mb-2 mt-6 text-sm font-semibold text-ink-950">{title}</h3>
        <Table
          head={head}
          mobileHide={mobileHide}
          mobileCards
          empty={list.length === 0 ? "Sin registros." : undefined}
        >
          {list.map((row) => {
            const item = itemsByKey.get(row.item_key);
            const capabilities = item?.capabilities ?? [];
            const priceCents = kind === "plan" ? (item?.priceCents ?? null) : row.price_cents;
            // shortcut: copia el redondeo de private.split_tax_included (IVA incluido); si cambia en SQL, cámbialo aquí.
            const withoutTaxCents = priceCents === null ? null : Math.round((priceCents * 10000) / (10000 + rate));
            return (
              <tr key={row.item_key} title={row.item_key} className="align-top">
                <td className="px-3 py-2.5 font-medium text-ink-950">{row.name}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {priceCents === null ? <Nil label="Sin precio" /> : formatMxn(priceCents)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-ink-800">
                  {withoutTaxCents === null ? <Nil label="Sin precio" /> : formatMxn(withoutTaxCents)}
                </td>
                <td className="px-3 py-2.5">
                  <ActiveBadge active={row.is_active} markActive={markActive} />
                </td>
                <td className="px-3 py-2.5">
                  {capabilities.length === 0 ? (
                    <Nil label="Sin funciones" />
                  ) : (
                    <details className="group">
                      <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-[13px] font-medium text-gold-800 hover:underline [&::-webkit-details-marker]:hidden">
                        <ChevronRight size={14} aria-hidden="true" className="transition-transform duration-[var(--dur-fast)] group-open:rotate-90 motion-reduce:transition-none" />
                        {capabilities.length} {capabilities.length === 1 ? "función" : "funciones"}
                      </summary>
                      <ul className="mt-1.5 flex flex-col gap-0.5 text-xs text-ink-800">
                        {capabilities.map((cap) => (
                          <li key={cap.capability_key}>
                            {capabilityName.get(cap.capability_key) ?? cap.capability_key}:{" "}
                            <span className="font-medium text-ink-950 tabular-nums">{formatValue(cap)}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs text-ink-600">
                  {row.stripe_product_id || row.stripe_price_id ? (
                    <div className="font-mono">
                      <p title="Producto">{row.stripe_product_id ? maskId(row.stripe_product_id) : <Nil label="Sin producto en Stripe" />}</p>
                      <p title="Precio">{row.stripe_price_id ? maskId(row.stripe_price_id) : <Nil label="Sin precio en Stripe" />}</p>
                    </div>
                  ) : (
                    "Sin vincular"
                  )}
                </td>
                <td className={cn("px-3 py-2.5 text-right tabular-nums", zeroClass(row.numero_ventas))}>{row.numero_ventas}</td>
                <td className={cn("px-3 py-2.5 text-right tabular-nums", zeroClass(row.ingresos_cents))}>
                  {formatMxn(row.ingresos_cents)}
                </td>
              </tr>
            );
          })}
        </Table>
      </>
    );
  };

  return (
    <section id="resumen" aria-labelledby="resumen-title" className="mb-10 scroll-mt-6">
      <h2 id="resumen-title" className="text-base font-semibold text-ink-950">
        Resumen comercial
      </h2>
      {section("plan", "Planes")}
      {section("addon", "Complementos")}
      <HowCalculated>
        <p>
          Cobrado neto = cobrado − reembolsos, pagos de Stripe (sin cortesías). Celebraloo cobra el precio de esta tabla; los
          IDs de Stripe solo son referencia.
        </p>
      </HowCalculated>
    </section>
  );
}
