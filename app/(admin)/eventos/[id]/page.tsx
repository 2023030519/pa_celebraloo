import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getEventDetail } from "@/lib/data/events";
import { formatMxn, formatValue, getCatalog, type CapabilityValue } from "@/lib/data/catalog";
import { Badge, Card, PageTitle, Table, formatDate } from "@/components/ui";
import { PermissionsEditor, type EditorCapability, type EditorOption } from "@/components/permissions-editor";
import { EventSuperTools } from "@/components/event-super-tools";
import { EventOverview } from "@/components/event-overview";
import { activeUnlock, isEditLocked } from "@/lib/edit-lock";

function rawValue(value: CapabilityValue): string {
  if (value.value_boolean !== null) return String(value.value_boolean);
  if (value.value_integer !== null) return String(value.value_integer);
  return value.value_text ?? "";
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const [event, catalog] = await Promise.all([getEventDetail(id), getCatalog()]);
  if (!event) notFound();

  const entitlementByKey = new Map(event.entitlements.map((row) => [row.capability_key, row]));
  const activeOverride = new Set(
    event.grants.filter((grant) => grant.source === "admin_override" && !grant.revokedAt).map((grant) => grant.capability_key)
  );
  const capabilityName = new Map(catalog.capabilities.map((cap) => [cap.key, cap.name]));

  const capabilities: EditorCapability[] = catalog.capabilities.map((cap) => {
    const current = entitlementByKey.get(cap.key);
    return {
      key: cap.key,
      name: cap.name,
      valueType: cap.valueType,
      enumValues: cap.enumValues,
      description: cap.description,
      current: current ? { label: formatValue(current), raw: rawValue(current), source: current.source } : null,
      hasOverride: activeOverride.has(cap.key),
    };
  });
  // Primero lo que tiene, después lo que no; dentro, por nombre.
  capabilities.sort((a, b) => Number(b.current !== null) - Number(a.current !== null) || a.name.localeCompare(b.name, "es"));

  const toOption = (item: (typeof catalog.plans)[number]): EditorOption => ({
    key: item.key,
    name: item.name,
    isActive: item.isActive,
    summary: `${item.capabilities.length} permisos · ${formatMxn(item.priceCents)}`,
  });

  const isTour = entitlementByKey.has("choose_plan");

  return (
    <>
      <PageTitle
        title={event.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {event.eventType} · {formatDate(event.eventDate)}
            {[event.city, event.state].filter(Boolean).length > 0 && ` · ${[event.city, event.state].filter(Boolean).join(", ")}`}
            {isTour && <Badge tone="info">Tour</Badge>}
            {event.archived && <Badge>Archivado</Badge>}
          </span>
        }
      />

      {admin.isSuperAdmin && <EventOverview eventId={event.id} />}

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <Card>
          <p className="text-xs font-semibold text-ink-600">Dueño</p>
          {event.owner.email ? (
            <Link href={`/usuarios/${event.owner.id}`} className="mt-1 block truncate font-medium hover:underline">
              {event.owner.email}
            </Link>
          ) : (
            <p className="mt-1">—</p>
          )}
        </Card>
        <Card>
          <p className="text-xs font-semibold text-ink-600">Miembros</p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {event.members.length === 0 && <li className="text-ink-600">Sin miembros</li>}
            {event.members.map((member) => (
              <li key={member.profileId} className="flex items-center justify-between gap-2">
                <Link href={`/usuarios/${member.profileId}`} className="truncate hover:underline">
                  {member.email || member.profileId}
                </Link>
                <Badge>{member.role}</Badge>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <p className="text-xs font-semibold text-ink-600">ID del evento</p>
          <p className="mt-1 break-all font-mono text-xs">{event.id}</p>
          <p className="mt-2 text-xs text-ink-600">Creado {formatDate(event.createdAt, true)}</p>
        </Card>
      </div>

      <h2 className="mb-1 text-[15px] font-semibold">Permisos y complementos</h2>
      <p className="mb-3 text-ink-600">
        Cada cambio se guarda como override de admin con tu nombre y el motivo. “Quitar” revoca el override: si el evento
        lo compró, vuelve a lo comprado; si no, se apaga.
      </p>
      <PermissionsEditor
        isSuperAdmin={admin.isSuperAdmin}
        eventId={event.id}
        capabilities={capabilities}
        plans={catalog.plans.map(toOption)}
        addons={catalog.addons.map(toOption)}
      />

      {admin.isSuperAdmin && (
        <>
          <h2 className="mb-1 mt-8 text-[15px] font-semibold">Superadmin</h2>
          <p className="mb-3 text-ink-600">Excepciones al bloqueo de edición y borrado permanente del evento.</p>
          <EventSuperTools
            eventId={event.id}
            eventName={event.name}
            locked={isEditLocked(event.eventDate, event.createdAt, event.editUnlockedUntil)}
            activeUnlock={activeUnlock(event.editUnlockedUntil)}
          />
        </>
      )}

      <h2 className="mb-2 mt-8 text-[15px] font-semibold">Compras</h2>
      <Table head={["Fecha", "Estado", "Conceptos", "Total"]} empty={event.purchases.length === 0 ? "Sin compras." : undefined}>
        {event.purchases.map((purchase) => (
          <tr key={purchase.id}>
            <td className="px-3 py-2.5 text-ink-600">{formatDate(purchase.createdAt, true)}</td>
            <td className="px-3 py-2.5">
              <Badge tone={purchase.status === "paid" ? "ok" : "neutral"}>{purchase.status}</Badge>
            </td>
            <td className="px-3 py-2.5">{purchase.items.map((item) => `${item.type}: ${item.key ?? "—"}`).join(", ") || "—"}</td>
            <td className="px-3 py-2.5 tabular-nums">{formatMxn(purchase.totalCents)}</td>
          </tr>
        ))}
      </Table>

      <h2 className="mb-2 mt-8 text-[15px] font-semibold">Auditoría</h2>
      <Table head={["Fecha", "Permiso", "Valor", "Quién", "Motivo", "Estado"]} empty={event.grants.length === 0 ? "Sin movimientos registrados." : undefined}>
        {event.grants.map((grant) => (
          <tr key={grant.id} className={grant.revokedAt ? "text-ink-600" : undefined}>
            <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(grant.grantedAt, true)}</td>
            <td className="px-3 py-2.5">{capabilityName.get(grant.capability_key) ?? grant.capability_key}</td>
            <td className="px-3 py-2.5">{formatValue(grant)}</td>
            <td className="px-3 py-2.5">{grant.grantedBy}</td>
            <td className="px-3 py-2.5">{grant.reason ?? "—"}</td>
            <td className="px-3 py-2.5">
              {grant.revokedAt ? (
                <span title={grant.revokedReason ?? undefined}>
                  <Badge>Revocado {formatDate(grant.revokedAt)}</Badge>
                </span>
              ) : (
                <Badge tone="ok">Activo</Badge>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
