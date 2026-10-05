import Link from "next/link";
import { can, requirePermission } from "@/lib/auth/require-admin";
import { listUsers } from "@/lib/data/users";
import { AccountToggle } from "@/components/account-toggle";
import { RoleCell } from "@/components/role-cell";
import { Badge, PageTitle, SearchForm, Table } from "@/components/ui";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const admin = await requirePermission("roles.write", "clientes.suspender");
  const { q = "" } = await searchParams;
  const users = await listUsers(q);

  return (
    <>
      <PageTitle title="Cuentas y roles" subtitle={`${users.length} ${users.length === 1 ? "usuario" : "usuarios"}`} />
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
                {!user.adminRole && user.isStaff && <Badge tone="info">Staff</Badge>}
              </span>
            </td>
            <td className="px-3 py-2.5">
              <RoleCell role={user.adminRole} />
            </td>
            <td className="px-3 py-2.5">
              <AccountToggle
                userId={user.id}
                disabled={user.disabled}
                locked={
                  !can(admin, "clientes.suspender")
                    ? "Sin permiso"
                    : user.id === admin.userId
                      ? "Tu cuenta"
                      : user.adminRole && !user.disabled
                        ? "Staff del panel"
                        : undefined
                }
              />
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
