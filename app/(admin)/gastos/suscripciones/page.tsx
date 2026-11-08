import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, CircleSlash, Plus } from "lucide-react";
import { can, requirePermission } from "@/lib/auth/require-admin";
import { getSubscriptions, type Subscription } from "@/lib/data/admin";
import { EXPENSE_CATEGORIES, formatDay, formatInt, formatMxn } from "@/lib/format";
import { Badge, HowCalculated, PageTitle, Table, cn, ui, zeroClass } from "@/components/ui";
import { DataError } from "@/components/finance";
import { SubscriptionStatusAction } from "@/components/subscription-status-action";

function NextCharge({ item }: { item: Subscription }) {
  if (item.status === "cancelado") return <span className="text-ink-600">Sin cobros</span>;
  const soon = item.periodicity === "anual" && item.days_to_next <= 15;
  return (
    <span className="flex flex-col">
      <span className="whitespace-nowrap">{formatDay(item.next_charge_date)}</span>
      <span className={cn("flex items-center gap-1 text-xs whitespace-nowrap", soon ? "font-medium text-info-700" : "text-ink-600")}>
        {soon && <CalendarClock size={12} aria-hidden="true" />}
        {item.days_to_next === 0 ? "Hoy" : item.days_to_next === 1 ? "Mañana" : `En ${formatInt(item.days_to_next)} días`}
        {soon && " · renovación anual"}
      </span>
    </span>
  );
}

export const metadata: Metadata = { title: "Suscripciones" };

const right = (text: string) => <span className="block text-right">{text}</span>;

export default async function SubscriptionsPage() {
  const admin = await requirePermission("gastos.read");
  const editable = can(admin, "gastos.write");

  let items: Subscription[];
  try {
    items = await getSubscriptions();
  } catch (error) {
    return (
      <>
        <PageTitle title="Suscripciones y servicios" />
        <DataError error={error} />
      </>
    );
  }

  const active = items.filter((item) => item.status === "activo");
  const monthly = active.reduce((sum, item) => sum + item.monthly_equivalent_cents, 0);
  const upcoming = active.filter((item) => item.days_to_next <= 30).slice(0, 5);

  return (
    <>
      <PageTitle
        breadcrumb={[{ href: "/gastos", label: "Gastos" }]}
        title="Suscripciones y servicios"
        subtitle={`Gastos que se repiten · ${formatInt(active.length)} ${active.length === 1 ? "activa" : "activas"}`}
        primaryAction={
          editable && (
            <Link href="/gastos/suscripciones/nueva" className={ui.buttonPrimary}>
              <Plus size={16} aria-hidden="true" /> Nueva suscripción
            </Link>
          )
        }
      />

      {/* Cifra y próximas renovaciones en un solo panel con divisor, no tarjeta + tarjeta. */}
      <section
        aria-label="Resumen"
        className="mb-6 grid overflow-hidden rounded-lg border border-ink-150 bg-surface md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
      >
        <div className="border-b border-ink-150 px-5 py-4 md:border-r md:border-b-0">
          <p className="text-[13px] font-medium text-ink-600">Costo mensual equivalente</p>
          <p className={cn("mt-1 text-[22px] leading-8 font-semibold sm:text-[28px] sm:leading-9 tracking-[-0.015em] tabular-nums", zeroClass(monthly, "text-ink-950"))}>{formatMxn(monthly)}</p>
          <p className="mt-1 text-xs text-ink-600">IVA incluido</p>
          <HowCalculated>
            <p>Los anuales cuentan como su doceava parte.</p>
            <p>Cada cobro se registra solo como gasto en su fecha, así cada mes refleja su costo real.</p>
          </HowCalculated>
        </div>
        <div className="px-5 py-4">
          <h2 className="text-base font-semibold text-ink-950">Próximas renovaciones (30 días)</h2>
          {upcoming.length === 0 ? (
            <p className="mt-2 text-sm text-ink-600">No hay cobros en los próximos 30 días.</p>
          ) : (
            <ul className="mt-2 divide-y divide-ink-150 text-sm">
              {upcoming.map((item) => (
                <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-1.5">
                  <span className="min-w-0 font-medium text-ink-950">
                    {item.concept}
                    <span className="ml-1.5 text-xs font-normal text-ink-600">{item.periodicity === "mensual" ? "Mensual" : "Anual"}</span>
                  </span>
                  <span className="text-ink-800 tabular-nums">
                    {formatDay(item.next_charge_date)} · <span className="font-medium text-ink-950">{formatMxn(item.total_cents)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {items.length === 0 ? (
        <div className="rounded-lg border border-ink-150 bg-surface px-4 py-10 text-center">
          <p className="text-sm font-medium text-ink-950">Aún no hay suscripciones registradas.</p>
          {editable && (
            <Link href="/gastos/suscripciones/nueva" className={cn(ui.buttonPrimary, "mt-4 max-md:hidden")}>
              <Plus size={16} aria-hidden="true" /> Nueva suscripción
            </Link>
          )}
        </div>
      ) : (
        <Table
          head={[
            "Servicio",
            "Categoría",
            "Se cobra",
            right("Por cobro (con IVA)"),
            right("Al mes (con IVA)"),
            "Próximo cobro",
            "Estado",
            ...(editable ? [<span key="acciones" className="sr-only">Acciones</span>] : []),
          ]}
          mobileHide={[1, 2, 4, 5, 7]}
          mobileCards
          caption="Suscripciones y servicios"
        >
          {items.map((item) => (
            <tr key={item.id} className={cn("relative align-top", item.status === "cancelado" && "text-ink-600")}>
              <td className="px-3 py-2.5">
                {editable ? (
                  <Link href={`/gastos/suscripciones/${item.id}`} className="font-medium hover:underline max-sm:after:absolute max-sm:after:inset-0">
                    {item.concept}
                  </Link>
                ) : (
                  <span className="font-medium">{item.concept}</span>
                )}
                {item.vendor && <p className="text-xs text-ink-600">{item.vendor}</p>}
                {item.status !== "cancelado" && (
                  <p className="text-xs whitespace-nowrap text-ink-600 sm:hidden">Próximo cobro {formatDay(item.next_charge_date)}</p>
                )}
              </td>
              <td className="px-3 py-2.5">{EXPENSE_CATEGORIES[item.category]?.split(" (")[0] ?? item.category}</td>
              <td className="px-3 py-2.5 whitespace-nowrap">{item.periodicity === "mensual" ? "Cada mes" : "Cada año"}</td>
              <td className={cn("px-3 py-2.5 text-right whitespace-nowrap tabular-nums", zeroClass(item.total_cents))}>{formatMxn(item.total_cents)}</td>
              <td className={cn("px-3 py-2.5 text-right whitespace-nowrap tabular-nums", zeroClass(item.monthly_equivalent_cents))}>{formatMxn(item.monthly_equivalent_cents)}</td>
              <td className="px-3 py-2.5">
                <NextCharge item={item} />
              </td>
              <td className="px-3 py-2.5">
                {/* Solo la excepción lleva chip: activa es lo normal. */}
                {item.status === "cancelado" && (
                  <Badge>
                    <CircleSlash size={12} aria-hidden="true" />
                    Cancelada
                  </Badge>
                )}
              </td>
              {editable && (
                <td className="px-3 py-2">
                  <span className="flex items-start gap-1">
                    <Link
                      href={`/gastos/suscripciones/${item.id}`}
                      className="inline-flex h-8 items-center rounded-md px-2.5 text-xs font-medium text-ink-800 hover:bg-surface-2 hover:text-ink-950"
                    >
                      Editar
                    </Link>
                    {/* Cancelar vive en la ficha (acción destructiva); reactivar se queda a la mano. */}
                    {item.status === "cancelado" && <SubscriptionStatusAction id={item.id} status={item.status} />}
                  </span>
                </td>
              )}
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
