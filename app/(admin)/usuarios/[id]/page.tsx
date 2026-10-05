import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getUserDetail } from "@/lib/data/users";
import { formatMxn } from "@/lib/data/catalog";
import { Badge, Card, PageTitle, Table, formatDate } from "@/components/ui";
import { AccountToggle } from "@/components/account-toggle";
import { RoleCell } from "@/components/role-cell";
import { UserSuperTools } from "@/components/user-super-tools";

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const user = await getUserDetail(id);
  if (!user) notFound();

  return (
    <>
      <PageTitle
        title={user.email}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {user.name || "Sin nombre"}
            {user.disabled && <Badge tone="danger">Cuenta deshabilitada</Badge>}
            {!user.confirmed && <Badge tone="danger">Correo sin confirmar</Badge>}
            {user.isPlatformAdmin ? <RoleCell user={user} canEdit={false} /> : user.isStaff && <Badge tone="info">Staff</Badge>}
          </span>
        }
        actions={
          <AccountToggle
            userId={user.id}
            disabled={user.disabled}
            locked={user.id === admin.userId ? "Tu cuenta" : user.isPlatformAdmin && !user.disabled ? "Admin" : undefined}
          />
        }
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-semibold text-ink-600">Registro</p>
          <p className="mt-1">{formatDate(user.createdAt, true)}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold text-ink-600">Último acceso</p>
          <p className="mt-1">{formatDate(user.lastSignInAt, true)}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold text-ink-600">ID</p>
          <p className="mt-1 break-all font-mono text-xs">{user.id}</p>
        </Card>
      </div>

      {admin.isSuperAdmin && (
        <>
          <h2 className="mb-2 text-[13px] font-semibold">Superadmin</h2>
          <div className="mb-6">
            <UserSuperTools
              userId={user.id}
              email={user.email}
              role={user.isSuperAdmin ? "superadmin" : user.isPlatformAdmin ? "admin" : "none"}
              isSelf={user.id === admin.userId}
              freePlanUsed={user.freePlanUsed}
            />
          </div>
        </>
      )}

      <h2 className="mb-2 text-[13px] font-semibold">Eventos</h2>
      <Table head={["Evento", "Tipo", "Fecha", "Rol"]} empty={user.events.length === 0 ? "No pertenece a ningún evento." : undefined}>
        {user.events.map((event) => (
          <tr key={event.id} className="hover:bg-paper">
            <td className="px-3 py-2.5">
              <Link href={`/eventos/${event.id}`} className="font-medium hover:underline">
                {event.name}
              </Link>
              {event.archived && (
                <span className="ml-2">
                  <Badge>Archivado</Badge>
                </span>
              )}
            </td>
            <td className="px-3 py-2.5 text-ink-600">{event.eventType}</td>
            <td className="px-3 py-2.5 text-ink-600">{formatDate(event.eventDate)}</td>
            <td className="px-3 py-2.5">
              <Badge tone={event.role === "owner" ? "gold" : "neutral"}>{event.role}</Badge>
            </td>
          </tr>
        ))}
      </Table>

      <h2 className="mb-2 mt-6 text-[13px] font-semibold">Compras</h2>
      <Table head={["Fecha", "Estado", "Total", "Evento"]} empty={user.purchases.length === 0 ? "Sin compras." : undefined}>
        {user.purchases.map((purchase) => (
          <tr key={purchase.id}>
            <td className="px-3 py-2.5 text-ink-600">{formatDate(purchase.createdAt, true)}</td>
            <td className="px-3 py-2.5">
              <Badge tone={purchase.status === "paid" ? "ok" : "neutral"}>{purchase.status}</Badge>
            </td>
            <td className="px-3 py-2.5 tabular-nums">{formatMxn(purchase.totalCents)}</td>
            <td className="px-3 py-2.5">
              {purchase.eventId ? (
                <Link href={`/eventos/${purchase.eventId}`} className="hover:underline">
                  Ver evento
                </Link>
              ) : (
                "—"
              )}
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
