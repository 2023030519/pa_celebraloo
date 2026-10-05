import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { listUsers } from "@/lib/data/users";
import { AccountToggle } from "@/components/account-toggle";
import { RoleCell } from "@/components/role-cell";
import { Badge, PageTitle, SearchForm, Table } from "@/components/ui";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const admin = await requireAdmin();
  const { q = "" } = await searchParams;
  const users = await listUsers(q);

  return (
    <>
      <PageTitle title="Usuarios" subtitle={`${users.length} ${users.length === 1 ? "usuario" : "usuarios"}`} />
      <SearchForm defaultValue={q} placeholder="Buscar por correo o nombre" />
      <Table
        head={["Usuario", "Número de eventos", "Estado", "Rol", "Habilitar / deshabilitar"]}
        empty={users.length === 0 ? "No hay usuarios que coincidan." : undefined}
      >
        {users.map((user) => (
          <tr key={user.id} className="hover:bg-paper">
            <td className="px-3 py-2.5">
              <Link href={`/usuarios/${user.id}`} className="font-medium hover:underline">
                {user.email}
              </Link>
              {user.name && <p className="text-xs text-ink-600">{user.name}</p>}
            </td>
            <td className="px-3 py-2.5 tabular-nums">{user.eventCount}</td>
            <td className="px-3 py-2.5">
              <span className="flex flex-wrap gap-1">
                {user.disabled ? <Badge tone="danger">Deshabilitada</Badge> : <Badge tone="ok">Activa</Badge>}
                {!user.confirmed && <Badge tone="danger">Sin confirmar</Badge>}
                {!user.isPlatformAdmin && user.isStaff && <Badge tone="info">Staff</Badge>}
              </span>
            </td>
            <td className="px-3 py-2.5">
              <RoleCell user={user} canEdit={admin.isSuperAdmin} />
            </td>
            <td className="px-3 py-2.5">
              <AccountToggle
                userId={user.id}
                disabled={user.disabled}
                locked={user.id === admin.userId ? "Tu cuenta" : user.isPlatformAdmin && !user.disabled ? "Admin" : undefined}
              />
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
