import type { Metadata } from "next";
import { CalendarClock, CircleCheck, CircleSlash } from "lucide-react";
import { can, requirePermission } from "@/lib/auth/require-admin";
import { formatMxn, getCatalog, type CatalogItem, type PlanPriceRow } from "@/lib/data/catalog";
import { formatDay } from "@/lib/format";
import { CatalogRowEditor, PlanPriceEditor } from "@/components/catalog-row-editor";
import { ActiveBadge, CatalogOverview, mostlyInactive, rightHead } from "@/components/catalog-overview";
import { Badge, cn, formatDate, HowCalculated, Nil, PageTitle, Segmented, Table, zeroClass } from "@/components/ui";

/** "del 1 dic 2026 al 30 nov 2027", "hasta el 30 nov 2026", "desde el 1 dic 2026" o "Sin límite". */
function validityLabel(price: PlanPriceRow): string {
  if (price.validFrom && price.validUntil) return `del ${formatDate(price.validFrom)} al ${formatDate(price.validUntil)}`;
  if (price.validUntil) return `hasta el ${formatDate(price.validUntil)}`;
  if (price.validFrom) return `desde el ${formatDate(price.validFrom)}`;
  return "Sin límite";
}

/** "$749.00 hasta el 30 nov 2026 · $1,290.00 desde el 1 dic 2026". */
function priceSummary(prices: PlanPriceRow[]): string {
  if (prices.length === 0) return "Sin precio: no se vende";
  return prices
    .map((price) => {
      const validity = validityLabel(price);
      return validity === "Sin límite" ? formatMxn(price.priceCents) : `${formatMxn(price.priceCents)} ${validity}`;
    })
    .join(" · ");
}

const PRICE_STATUS = {
  current: (
    <Badge tone="ok">
      <CircleCheck size={12} aria-hidden="true" />
      Vigente hoy
    </Badge>
  ),
  scheduled: (
    <Badge tone="info">
      <CalendarClock size={12} aria-hidden="true" />
      Programado
    </Badge>
  ),
  expired: (
    <Badge>
      <CircleSlash size={12} aria-hidden="true" />
      Vencido
    </Badge>
  ),
};

/** Encabezado de sección; su explicación va en "Cómo se calcula", debajo de la tabla. */
function SectionHead({ level, title }: { level: "h2" | "h3"; title: string }) {
  const Heading = level;
  return <Heading className={level === "h2" ? "mb-3 text-base font-semibold text-ink-950" : "mb-3 text-sm font-semibold text-ink-950"}>{title}</Heading>;
}

function ReadOnlyRows({ kind, items }: { kind: "plan" | "addon"; items: CatalogItem[] }) {
  const markActive = mostlyInactive(items.map((item) => ({ active: item.isActive })));
  return items.map((item) => (
    <tr key={item.key} title={item.key}>
      <td className="px-3 py-2.5 font-medium text-ink-950">{item.name}</td>
      <td className={kind === "addon" ? "px-3 py-2.5 text-right tabular-nums" : "px-3 py-2.5 text-[13px] tabular-nums"}>
        {item.prices.length ? priceSummary(item.prices) : item.priceCents === null ? <Nil label="Sin precio" /> : formatMxn(item.priceCents)}
      </td>
      <td className="px-3 py-2.5">
        <ActiveBadge active={item.isActive} markActive={markActive} />
      </td>
      <td className={cn("px-3 py-2.5", zeroClass(item.capabilities.length, "text-ink-600"))}>{item.capabilities.length} permisos</td>
    </tr>
  ));
}

export const metadata: Metadata = { title: "Planes" };

type Vista = "resumen" | "paquetes" | "precios" | "complementos";

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const admin = await requirePermission("planes.read");
  const editable = can(admin, "planes.write");
  const catalog = await getCatalog();
  // Ventas e ingresos por producto: quien ve montos de ventas.
  const showOverview = can(admin, "ventas.financiero");
  const lastHead = editable ? "Guardar" : "Incluye";
  const head = {
    plan: ["Nombre", "Precio por vigencia (IVA incluido)", "Estado", lastHead],
    addon: ["Nombre", rightHead("Precio con IVA (MXN)"), "Estado", lastHead],
  };
  // Sección h2 si no hay grupo "Editar catálogo" que las contenga.
  const level = editable ? "h3" : "h2";

  const rows = (kind: "plan" | "addon", items: CatalogItem[]) =>
    editable ? (
      items.map((item) => (
        <CatalogRowEditor
          key={item.key}
          kind={kind}
          itemKey={item.key}
          name={item.name}
          priceCents={item.priceCents}
          priceLabel={kind === "plan" ? priceSummary(item.prices) : undefined}
          isActive={item.isActive}
          sellable={kind === "addon" || item.prices.some((price) => price.status !== "expired")}
        />
      ))
    ) : (
      <ReadOnlyRows kind={kind} items={items} />
    );

  const planPrices = catalog.plans.flatMap((plan) => plan.prices.map((price) => ({ plan, price })));
  const sections: [Vista, string][] = [
    ...(showOverview ? [["resumen", "Resumen comercial"] as [Vista, string]] : []),
    ["paquetes", "Planes"],
    ["precios", "Precios de planes"],
    ["complementos", "Complementos"],
  ];
  const requested = (await searchParams).vista;
  const vista = sections.find(([key]) => key === requested)?.[0] ?? (showOverview ? "resumen" : "paquetes");
  // En edición, bajo sm las filas se apilan (CatalogRowEditor): la tabla deja de ser tabla y su encabezado se oculta.
  const stack = editable ? "max-sm:[&_table]:block max-sm:[&_tbody]:block max-sm:[&_thead]:hidden" : undefined;
  // Solo lectura, bajo sm: nombre, precio y estado (R9); "Incluye" y las fechas se ocultan.
  const mobileHide = (hide: number[]) => (editable ? [] : hide);

  return (
    <>
      <PageTitle
        title={editable ? "Planes y complementos" : "Catálogo"}
        subtitle={
          editable
            ? "Los cambios aplican desde el siguiente pago; lo ya comprado no cambia."
            : "Solo lectura: editar planes y precios es de superadmin."
        }
      />

      <div className="mb-6">
        <Segmented wrap label="Vista" options={sections} current={vista} href={(key) => `/catalogo?vista=${key}`} />
      </div>

      {vista === "resumen" && <CatalogOverview catalog={catalog} />}

      {editable && vista !== "resumen" && (
        <>
          <h2 className="mb-1 text-base font-semibold text-ink-950">Editar catálogo</h2>
          <p className="mb-6 text-sm text-ink-600">Cada cambio pide un motivo y queda en Actividad con el antes y el después.</p>
        </>
      )}

      {vista === "paquetes" && (
        <>
          <SectionHead level={level} title="Planes" />
          <div className={stack}>
            <Table head={head.plan} mobileHide={mobileHide([3])} empty={catalog.plans.length === 0 ? "Sin planes." : undefined}>
              {rows("plan", catalog.plans)}
            </Table>
          </div>
          <HowCalculated>
            <p>
              Las funciones y límites de un plan se copian al evento cuando se compra o se asigna. Si cambian, aplican solo a
              compras nuevas: los eventos ya comprados conservan lo que recibieron. Aquí no se editan.
            </p>
          </HowCalculated>
        </>
      )}

      {vista === "precios" && (
        <>
          <SectionHead level={level} title="Precios de planes" />
          <div className={stack}>
            <Table
              head={[
                "Plan",
                rightHead("Precio con IVA (MXN)"),
                "Vigencia del pago",
                "Solo eventos hasta",
                "Estado",
                ...(editable ? ["Guardar"] : []),
              ]}
              mobileHide={mobileHide([2, 3])}
              mobileCards={!editable}
              empty={planPrices.length === 0 ? "Sin precios." : undefined}
            >
              {planPrices.map(({ plan, price }) => {
                // En edición la fila mide lo que el campo de precio (32 px): el texto baja para quedar a su altura.
                const cell = editable ? "block px-3 py-1.5 sm:table-cell sm:pb-2.5 sm:pt-4" : "px-3 py-2.5";
                // Filas apiladas en móvil, sin encabezado: cada dato dice qué es.
                const label = (text: string) => editable && <span className="text-ink-600 sm:hidden">{text}: </span>;
                const cells = (
                  <>
                    <td className={cell}>
                      {label("Vigencia del pago")}
                      {validityLabel(price)}
                    </td>
                    <td className={cell}>
                      {label("Solo eventos hasta")}
                      {price.eventDateUntil ? formatDay(price.eventDateUntil) : "Cualquier fecha"}
                    </td>
                    <td className={editable ? "block px-3 py-1.5 sm:table-cell sm:pb-2.5 sm:pt-3.5" : cell}>{PRICE_STATUS[price.status]}</td>
                  </>
                );
                return editable ? (
                  <PlanPriceEditor key={price.id} id={price.id} planName={plan.name} priceCents={price.priceCents}>
                    {cells}
                  </PlanPriceEditor>
                ) : (
                  <tr key={price.id}>
                    <td className={cell}>
                      <span className="font-medium text-ink-950">{plan.name}</span>
                      {/* La vigencia distingue los tramos de un mismo plan: en móvil baja bajo el nombre. */}
                      <span className="block text-xs text-ink-600 sm:hidden">{validityLabel(price)}</span>
                    </td>
                    <td className={`${cell} text-right tabular-nums`}>{formatMxn(price.priceCents)}</td>
                    {cells}
                  </tr>
                );
              })}
            </Table>
          </div>
          <HowCalculated>
            <p>
              Lo que cobra el checkout, por vigencia de pago. Un precio con “Solo eventos hasta” aplica si el evento es hasta
              esa fecha; si no, se cobra el siguiente vigente. Las fechas de vigencia no se editan aquí: pídelas a desarrollo.
            </p>
          </HowCalculated>
        </>
      )}

      {vista === "complementos" && (
        <>
          <SectionHead level={level} title="Complementos" />
          <div className={stack}>
            <Table head={head.addon} mobileHide={mobileHide([3])} mobileCards={!editable} empty={catalog.addons.length === 0 ? "Sin complementos." : undefined}>
              {rows("addon", catalog.addons)}
            </Table>
          </div>
          <HowCalculated>
            <p>
              Sin precio = no se vende. Inactivo = se oculta de la tienda y el checkout lo rechaza. Los cupos por escalones
              (álbum y galería) cobran la diferencia calculada en Celebraloo, no este precio.
            </p>
          </HowCalculated>
        </>
      )}
    </>
  );
}
