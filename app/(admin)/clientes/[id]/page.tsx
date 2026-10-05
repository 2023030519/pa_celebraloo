import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/require-admin";
import { getCustomerCard } from "@/lib/data/admin";
import { getCatalog } from "@/lib/data/catalog";
import { formatDay, formatMxn } from "@/lib/format";
import { Badge, Card, PageTitle, Table, formatDate } from "@/components/ui";
import { DataError, EventStatusBadge, PaymentStatusBadge } from "@/components/finance";
import { NotesPanel } from "@/components/notes-panel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-ink-600">{label}</p>
      <p className="mt-0.5 font-medium break-all">{children}</p>
    </div>
  );
}

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  let card;
  try {
    card = await getCustomerCard(id);
  } catch (error) {
    return <DataError error={error} />;
  }
  if (!card) notFound();

  const catalog = await getCatalog();
  const planName = (key: string | null) => (key ? catalog.plans.find((plan) => plan.key === key)?.name ?? key : "—");

  return (
    <>
      <PageTitle
        title={card.name ?? card.email}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {card.email}
            {card.disabled && <Badge tone="danger">Cuenta deshabilitada</Badge>}
            {card.spent_cents > 0 ? <Badge tone="ok">De pago</Badge> : <Badge>Gratuito</Badge>}
            {card.is_staff && <Badge tone="info">Staff (no cuenta en métricas)</Badge>}
          </span>
        }
        actions={
          <Link
            href={`/usuarios/${card.id}`}
            className="inline-flex h-9 items-center rounded-md border border-ink-250 bg-surface px-3 font-semibold text-ink-800 hover:bg-paper"
          >
            Cuenta y acceso
          </Link>
        }
      />

      <Card className="mb-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Fact label="Nombre">{card.name ?? "—"}</Fact>
          <Fact label="Email">{card.email}</Fact>
          <Fact label="Teléfono">{card.phone || "—"}</Fact>
          <Fact label="Registro">{formatDate(card.registered_at, true)}</Fact>
          <Fact label="Último acceso">{formatDate(card.last_sign_in_at, true)}</Fact>
          <Fact label="Plan actual">{planName(card.current_plan_key)}</Fact>
          <Fact label="Total gastado">{formatMxn(card.spent_cents)}</Fact>
          <Fact label="Eventos">{card.events}</Fact>
        </div>
        <div className="mt-4 border-t border-ink-150 pt-3">
          <p className="text-xs font-semibold text-ink-600">Complementos comprados</p>
          <p className="mt-1">{card.addons.length ? card.addons.join(", ") : "Ninguno"}</p>
        </div>
      </Card>

      <h2 className="mb-2 text-[15px] font-semibold">Historial de compras</h2>
      <div className="mb-6">
        <Table head={["Fecha", "Producto", "Total", "Reembolsado", "Estado"]} empty={card.purchases.length === 0 ? "Sin compras." : undefined}>
          {card.purchases.map((purchase) => (
            <tr key={purchase.id} className="hover:bg-paper">
              <td className="px-3 py-2.5 whitespace-nowrap">
                <Link href={`/ventas/${purchase.id}`} className="hover:underline">
                  {formatDate(purchase.sale_at, true)}
                </Link>
              </td>
              <td className="px-3 py-2.5">
                {purchase.item_name ?? "—"}
                {purchase.item_type === "addon" && <span className="ml-1 text-xs text-ink-600">(complemento)</span>}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatMxn(purchase.total_cents)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{purchase.refunded_cents ? formatMxn(purchase.refunded_cents) : "—"}</td>
              <td className="px-3 py-2.5">
                <PaymentStatusBadge status={purchase.display_status} />
              </td>
            </tr>
          ))}
        </Table>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-[15px] font-semibold">Eventos</h2>
          <Table head={["Evento", "Fecha", "Plan", "Estado"]} empty={card.events_list.length === 0 ? "Sin eventos." : undefined}>
            {card.events_list.map((event) => (
              <tr key={event.id} className="hover:bg-paper">
                <td className="px-3 py-2.5">
                  <Link href={`/eventos/${event.id}`} className="font-medium hover:underline">
                    {event.name}
                  </Link>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">{formatDay(event.event_date)}</td>
                <td className="px-3 py-2.5">{planName(event.plan_key)}</td>
                <td className="px-3 py-2.5">
                  <EventStatusBadge status={event.status} />
                </td>
              </tr>
            ))}
          </Table>
        </div>
        <NotesPanel targetType="customer" targetId={card.id} />
      </div>
    </>
  );
}
