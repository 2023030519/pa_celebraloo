import "server-only";
import { getCatalogOverview, type CatalogOverviewRow } from "@/lib/data/admin";
import { formatValue, type Catalog } from "@/lib/data/catalog";
import { formatMxn } from "@/lib/format";
import { maskId } from "@/lib/stripe-links";
import { Badge, Table } from "@/components/ui";
import { DataError } from "@/components/finance";

/**
 * Resumen comercial de Planes (sección 9 del brief), solo lectura. Precio sin
 * IVA, ventas e ingresos salen de admin_catalog_overview; funciones y límites,
 * del catálogo de capabilities.
 */
export async function CatalogOverview({ catalog }: { catalog: Catalog }) {
  let rows: CatalogOverviewRow[];
  try {
    rows = await getCatalogOverview();
  } catch (error) {
    return (
      <div className="mb-8">
        <DataError error={error} />
      </div>
    );
  }
  const capabilityName = new Map(catalog.capabilities.map((cap) => [cap.key, cap.name]));
  const itemsByKey = new Map([...catalog.plans, ...catalog.addons].map((item) => [item.key, item]));
  const rate = rows[0]?.tax_rate_bps ?? 1600;

  const section = (kind: "plan" | "addon", title: string) => {
    const list = rows.filter((row) => row.item_type === kind);
    return (
      <>
        <h2 className="mb-2 mt-6 text-[15px] font-semibold first:mt-0">{title}</h2>
        <Table
          head={["Nombre", "Precio con IVA", `Sin IVA (${rate / 100}%)`, "Estado", "Funciones y límites", "Stripe", "Ventas", "Ingresos"]}
          empty={list.length === 0 ? "Sin registros." : undefined}
        >
          {list.map((row) => {
            const capabilities = itemsByKey.get(row.item_key)?.capabilities ?? [];
            return (
              <tr key={row.item_key} className="align-top">
                <td className="px-3 py-2.5">
                  <p className="font-medium">{row.name}</p>
                  <p className="font-mono text-[11px] text-ink-600">{row.item_key}</p>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{row.price_cents === null ? "Sin precio" : formatMxn(row.price_cents)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-ink-800">{formatMxn(row.price_without_tax_cents)}</td>
                <td className="px-3 py-2.5">{row.is_active ? <Badge tone="ok">Activo</Badge> : <Badge>Inactivo</Badge>}</td>
                <td className="px-3 py-2.5">
                  {capabilities.length === 0 ? (
                    <span className="text-ink-600">—</span>
                  ) : (
                    <details>
                      <summary className="cursor-pointer text-xs font-semibold text-gold-800">{capabilities.length} funciones</summary>
                      <ul className="mt-1 flex flex-col gap-0.5 text-xs">
                        {capabilities.map((cap) => (
                          <li key={cap.capability_key}>
                            {capabilityName.get(cap.capability_key) ?? cap.capability_key}:{" "}
                            <span className="font-semibold">{formatValue(cap)}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </td>
                <td className="px-3 py-2.5 font-mono text-[11px] text-ink-600">
                  <p title="Producto">{maskId(row.stripe_product_id)}</p>
                  <p title="Precio">{maskId(row.stripe_price_id)}</p>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{row.numero_ventas}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatMxn(row.ingresos_cents)}</td>
              </tr>
            );
          })}
        </Table>
      </>
    );
  };

  return (
    <div className="mb-10">
      {section("plan", "Planes")}
      {section("addon", "Complementos")}
      <p className="mt-2 text-xs text-ink-600">
        Ingresos = cobrado − reembolsado, pagos de Stripe (sin cortesías). El checkout cobra con el precio de la base
        (price_data), así que los IDs de Stripe son informativos.
      </p>
    </div>
  );
}
