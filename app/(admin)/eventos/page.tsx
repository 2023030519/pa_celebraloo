import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { listEvents } from "@/lib/data/events";
import { Badge, PageTitle, SearchForm, Table, formatDate } from "@/components/ui";
import { SuperEventsList } from "@/components/super-events-list";

type Search = { q?: string; estado?: string; staff?: string; pagina?: string };

export default async function EventsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const admin = await requireAdmin();
  const params = await searchParams;
  if (admin.isSuperAdmin) return <SuperEventsList params={params} />;
  const { q = "" } = params;
  const events = await listEvents(q);

  return (
    <>
      <PageTitle title="Eventos" subtitle={`${events.length} ${events.length === 1 ? "evento" : "eventos"}`} />
      <SearchForm defaultValue={q} placeholder="Buscar por nombre, correo del dueño o ID" />
      <Table
        head={["Evento", "Dueño", "Tipo", "Fecha", "Permisos", ""]}
        empty={events.length === 0 ? "No hay eventos que coincidan." : undefined}
      >
        {events.map((event) => (
          <tr key={event.id} className="hover:bg-paper">
            <td className="px-3 py-2.5">
              <Link href={`/eventos/${event.id}`} className="font-medium hover:underline">
                {event.name}
              </Link>
              <p className="text-xs text-ink-600">Creado {formatDate(event.createdAt)}</p>
            </td>
            <td className="px-3 py-2.5 text-ink-600">{event.ownerEmail || "—"}</td>
            <td className="px-3 py-2.5 text-ink-600">{event.eventType}</td>
            <td className="px-3 py-2.5 text-ink-600">{formatDate(event.eventDate)}</td>
            <td className="px-3 py-2.5 tabular-nums">{event.entitlementCount}</td>
            <td className="px-3 py-2.5">
              <span className="flex flex-wrap gap-1">
                {event.isTour && <Badge tone="info">Tour</Badge>}
                {event.archived && <Badge>Archivado</Badge>}
              </span>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
