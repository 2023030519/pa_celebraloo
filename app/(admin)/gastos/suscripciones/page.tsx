import Link from "next/link";
import { CalendarClock, Plus } from "lucide-react";
import { can, requirePermission } from "@/lib/auth/require-admin";
import { getSubscriptions, type Subscription } from "@/lib/data/admin";
import { EXPENSE_CATEGORIES, formatDay, formatInt, formatMxn } from "@/lib/format";
import { Badge, Card, PageTitle, Table, cn } from "@/components/ui";
import { DataError } from "@/components/finance";
import { KpiTile } from "@/components/kpi";
import { SubscriptionStatusAction } from "@/components/subscription-status-action";

function NextCharge({ item }: { item: Subscription }) {
  if (item.status === "cancelado") return <span className="text-ink-600">—</span>;
  const soon = item.periodicity === "anual" && item.days_to_next <= 15;
  return (
    <span className="flex flex-col">
      <span className="whitespace-nowrap">{formatDay(item.next_charge_date)}</span>
      <span className={cn("flex items-center gap-1 text-xs", soon ? "font-semibold text-info-700" : "text-ink-600")}>
        {soon && <CalendarClock size={12} aria-hidden="true" />}
        {item.days_to_next === 0 ? "Hoy" : item.days_to_next === 1 ? "Mañana" : `En ${formatInt(item.days_to_next)} días`}
        {soon && " · renovación anual"}
      </span>
    </span>
  );
}

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
        title="Suscripciones y servicios"
        subtitle={
          <>
            Gastos que se repiten. Cada cobro se registra solo como gasto en su fecha, así cada mes refleja su costo real.{" "}
            <Link href="/gastos" className="font-semibold text-gold-800 hover:underline">
              Ver gastos
            </Link>
          </>
        }
        actions={
          editable && (
            <Link
              href="/gastos/suscripciones/nueva"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-ink-950 px-4 font-semibold text-surface hover:bg-ink-800"
            >
              <Plus size={16} aria-hidden="true" /> Nueva suscripción
            </Link>
          )
        }
      />

      <div className="mb-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <KpiTile
          label="Costo mensual equivalente"
          value={formatMxn(monthly)}
          hint={`${formatInt(active.length)} activas · los anuales cuentan como su doceava parte.`}
          emphasis
        />
        <Card title="Próximas renovaciones (30 días)">
          {upcoming.length === 0 ? (
            <p className="text-ink-600">No hay cobros en los próximos 30 días.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {upcoming.map((item) => (
                <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">
                    {item.concept}
                    <span className="ml-1 text-xs font-normal text-ink-600">({item.periodicity})</span>
                  </span>
                  <span className="tabular-nums text-ink-800">
                    {formatMxn(item.total_cents)} · {formatDay(item.next_charge_date)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Table
        head={["Servicio", "Categoría", "Se cobra", "Por cobro", "Al mes", "Próximo cobro", "Estado", ""]}
        empty={items.length === 0 ? "Aún no hay suscripciones registradas." : undefined}
      >
        {items.map((item) => (
          <tr key={item.id} className={cn("align-top hover:bg-paper", item.status === "cancelado" && "text-ink-600")}>
            <td className="px-3 py-2.5">
              <span className="font-medium">{item.concept}</span>
              {item.vendor && <p className="text-xs text-ink-600">{item.vendor}</p>}
            </td>
            <td className="px-3 py-2.5">{EXPENSE_CATEGORIES[item.category]?.split(" (")[0] ?? item.category}</td>
            <td className="px-3 py-2.5">{item.periodicity === "mensual" ? "Cada mes" : "Cada año"}</td>
            <td className="px-3 py-2.5 text-right tabular-nums">{formatMxn(item.total_cents)}</td>
            <td className="px-3 py-2.5 text-right tabular-nums">{formatMxn(item.monthly_equivalent_cents)}</td>
            <td className="px-3 py-2.5">
              <NextCharge item={item} />
            </td>
            <td className="px-3 py-2.5">{item.status === "activo" ? <Badge tone="ok">Activa</Badge> : <Badge>Cancelada</Badge>}</td>
            <td className="px-3 py-2.5">
              {editable && (
                <span className="flex flex-col items-start gap-2">
                  <Link href={`/gastos/suscripciones/${item.id}`} className="text-xs font-semibold text-gold-800 hover:underline">
                    Editar
                  </Link>
                  <SubscriptionStatusAction id={item.id} status={item.status} />
                </span>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
