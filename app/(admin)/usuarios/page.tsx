import type { Metadata } from "next";
import Link from "next/link";
import { Ban, MailWarning } from "lucide-react";
import { requirePermission } from "@/lib/auth/require-admin";
import { listUsers } from "@/lib/data/users";
import { ADMIN_ROLES } from "@/lib/auth/permissions";
import { RoleCell, RoleScope } from "@/components/role-cell";
import { Badge, PageTitle, Table, zeroClass } from "@/components/ui";
import { FilterBar, SearchField } from "@/components/filters";

export const metadata: Metadata = { title: "Cuentas y roles" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePermission("roles.write", "clientes.suspender");
  const { q = "" } = await searchParams;
  const users = await listUsers(q);

  return (
    <>
      <PageTitle title="Cuentas y roles" subtitle="Rol, suspensión y borrado se cambian en la ficha de cada cuenta, con motivo." />
      <FilterBar resetHref="/usuarios" active={Boolean(q)} count={`${users.length} ${users.length === 1 ? "cuenta" : "cuentas"}`}>
        <SearchField label="Buscar por correo o nombre" placeholder="Correo o nombre" defaultValue={q} />
      </FilterBar>
      {/* Suspender vive en la ficha (R4): la fila entera es el enlace. */}
      <Table
        head={[
          "Cuenta",
          <span key="n" className="block text-right">
            Eventos
          </span>,
          "Estado",
          "Rol en el panel",
        ]}
        caption="Cuentas"
        mobileHide={[1, 2, 3]}
        mobileCards
        empty={users.length === 0 ? (q ? "Ninguna cuenta coincide con esa búsqueda." : "Aún no hay cuentas.") : undefined}
      >
        {users.map((user) => {
          // Solo excepciones (R13): "Activa" es lo normal y no lleva chip.
          const chips = (
            <>
              {user.disabled && (
                <Badge tone="danger">
                  <Ban size={12} aria-hidden="true" /> Suspendida
                </Badge>
              )}
              {!user.confirmed && (
                <Badge tone="warn">
                  <MailWarning size={12} aria-hidden="true" /> Sin confirmar
                </Badge>
              )}
              {!user.adminRole && user.isStaff && <Badge>Staff</Badge>}
            </>
          );
          const hasChips = user.disabled || !user.confirmed || (!user.adminRole && user.isStaff);
          return (
            <tr key={user.id} className="relative align-top">
              <td className="max-w-[15rem] px-3 py-2.5 max-sm:max-w-none sm:max-w-[20rem]">
                {/* Persona = nombre y correo debajo (R10); sin nombre, el correo va primero. */}
                <Link
                  href={`/usuarios/${user.id}`}
                  title={user.name || user.email}
                  className="block truncate font-medium text-ink-950 underline-offset-[3px] after:absolute after:inset-0 hover:text-gold-800 hover:underline"
                >
                  {user.name || user.email}
                </Link>
                {user.name && (
                  <span title={user.email} className="block truncate text-xs text-ink-600">
                    {user.email}
                  </span>
                )}
                {/* Móvil: Estado y Rol se ocultan; bajan aquí solo si hay algo que marcar (sin "—", R22). */}
                {(user.adminRole || hasChips) && (
                  <span className="mt-1 flex flex-wrap gap-1 sm:hidden">
                    {user.adminRole && <RoleCell role={user.adminRole} />}
                    {chips}
                  </span>
                )}
              </td>
              <td className={`px-3 py-2.5 text-right tabular-nums ${zeroClass(user.eventCount)}`}>{user.eventCount}</td>
              <td className="px-3 py-2.5">
                <span className="flex flex-wrap gap-1">{chips}</span>
              </td>
              <td className="px-3 py-2.5">
                <RoleCell role={user.adminRole} />
              </td>
            </tr>
          );
        })}
      </Table>

      {/* Qué abre cada rol: "Puede" y "No puede", como Stripe. */}
      <section aria-labelledby="roles" className="mt-8">
        <h2 id="roles" className="text-base font-semibold text-ink-950">
          Qué puede hacer cada rol
        </h2>
        <p className="mt-1 mb-3 max-w-[75ch] text-[13px] text-ink-600">
          Los permisos se validan en el servidor y en la base de datos; el panel solo oculta lo que el rol no puede usar.
        </p>
        <ul className="grid gap-px overflow-hidden rounded-lg border border-ink-150 bg-ink-150 md:grid-cols-2 xl:grid-cols-4">
          {ADMIN_ROLES.map((role) => (
            <li key={role} className="flex flex-col items-start gap-3 bg-surface p-4">
              <RoleCell role={role} />
              <RoleScope role={role} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
