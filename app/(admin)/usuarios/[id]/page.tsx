import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, MailWarning } from "lucide-react";
import { can, requirePermission } from "@/lib/auth/require-admin";
import { getUserDetail } from "@/lib/data/users";
import { formatMxn } from "@/lib/data/catalog";
import { Badge, Breadcrumb, Email, Nil, SectionNav, Table, formatDate } from "@/components/ui";
import { PaymentStatusBadge } from "@/components/finance";
import { EVENT_TYPE, MEMBER_ROLE, formatDay } from "@/lib/format";
import { AccountToggle } from "@/components/account-toggle";
import { RoleCell } from "@/components/role-cell";
import { UserSuperTools } from "@/components/user-super-tools";

export const metadata: Metadata = { title: "Cuenta" };

const linkClass = "font-medium text-ink-950 underline-offset-[3px] hover:text-gold-800 hover:underline";

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePermission("roles.write", "clientes.suspender");
  const canEditRole = can(admin, "roles.write");
  const canResetFreePlan = can(admin, "clientes.plan_gratis");
  const canDelete = can(admin, "clientes.borrar");
  const { id } = await params;
  const user = await getUserDetail(id);
  if (!user) notFound();
  const canSuspend = can(admin, "clientes.suspender");
  // Por qué no se ofrece Suspender: la propia cuenta o un staff activo del panel.
  const status = user.id === admin.userId ? "Tu cuenta" : user.adminRole && !user.disabled ? "Staff del panel" : null;

  return (
    <>
      {/* Encabezado de identidad: breadcrumb, correo, estado y la acción de la cuenta a la derecha. */}
      <Breadcrumb items={[{ href: "/usuarios", label: "Cuentas y roles" }]} />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 grow basis-72">
          <h1 className="text-2xl font-semibold tracking-[-0.015em] text-ink-950">
            <Email value={user.email} />
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-ink-600">
            <span>{user.name || <Nil label="Sin nombre" />}</span>
            {user.disabled && (
              <Badge tone="danger">
                <Ban size={12} aria-hidden="true" /> Cuenta suspendida
              </Badge>
            )}
            {!user.confirmed && (
              <Badge tone="warn">
                <MailWarning size={12} aria-hidden="true" /> Correo sin confirmar
              </Badge>
            )}
            {user.adminRole ? (
              <RoleCell role={user.adminRole} />
            ) : (
              user.isStaff && <Badge>Staff</Badge>
            )}
            {status && <Badge>{status}</Badge>}
          </div>
        </div>
        {/* Sin acción posible, el lugar queda vacío: el porqué va como estado junto al rol. */}
        {canSuspend && !status && <AccountToggle userId={user.id} disabled={user.disabled} />}
      </div>
      <SectionNav
        items={[
          { id: "resumen", label: "Resumen" },
          { id: "eventos", label: "Eventos" },
          { id: "compras", label: "Compras" },
          ...(canEditRole || canResetFreePlan || canDelete ? [{ id: "acciones", label: "Acciones" }] : []),
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        {/* Lateral: en móvil sube arriba como resumen. */}
        <aside className="flex flex-col gap-6 lg:order-2">
          <section id="resumen" aria-labelledby="summary" className="rounded-lg border border-ink-150 bg-surface">
            <h2 id="summary" className="border-b border-ink-150 px-4 py-3 text-base font-semibold text-ink-950">
              Resumen
            </h2>
            <dl className="flex flex-col divide-y divide-ink-150 text-[13px]">
              <div className="flex justify-between gap-3 px-4 py-2.5">
                <dt className="text-ink-600">Registro</dt>
                <dd className="text-right text-ink-950 tabular-nums">{formatDate(user.createdAt, true)}</dd>
              </div>
              <div className="flex justify-between gap-3 px-4 py-2.5">
                <dt className="text-ink-600">Último acceso</dt>
                <dd className="text-right text-ink-950 tabular-nums">{user.lastSignInAt ? formatDate(user.lastSignInAt, true) : <Nil label="Sin accesos" />}</dd>
              </div>
              <div className="flex flex-col gap-0.5 px-4 py-2.5">
                <dt className="text-ink-600">ID</dt>
                <dd className="font-mono text-xs break-words text-ink-800">{user.id}</dd>
              </div>
            </dl>
          </section>
        </aside>

        <div className="flex min-w-0 flex-col gap-6 lg:order-1">
          <div id="eventos">
            <Table
              title={
                <>
                  Eventos <span className="font-normal text-ink-600 tabular-nums">· {user.events.length}</span>
                </>
              }
              caption="Eventos"
              head={["Evento", "Tipo", "Fecha", "Rol"]}
              mobileHide={[1, 2]}
              mobileCards
              empty={user.events.length === 0 ? "No pertenece a ningún evento." : undefined}
            >
              {user.events.map((event) => (
                <tr key={event.id} className="max-sm:relative">
                  <td className="px-3 py-2.5">
                    <Link href={`/eventos/${event.id}`} className={`${linkClass} max-sm:after:absolute max-sm:after:inset-0`}>
                      {event.name}
                    </Link>
                    {event.archived && (
                      <span className="ml-2">
                        <Badge>Archivado</Badge>
                      </span>
                    )}
                    <p className="mt-0.5 text-xs text-ink-600 sm:hidden">
                      {EVENT_TYPE[event.eventType] ?? event.eventType} · {event.eventDate ? formatDay(event.eventDate) : <Nil label="Sin fecha" />}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-ink-800">{EVENT_TYPE[event.eventType] ?? event.eventType}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-ink-800 tabular-nums">{event.eventDate ? formatDay(event.eventDate) : <Nil label="Sin fecha" />}</td>
                  <td className="px-3 py-2.5">
                    <Badge>{MEMBER_ROLE[event.role] ?? event.role}</Badge>
                  </td>
                </tr>
              ))}
            </Table>
          </div>

          <div id="compras">
            <Table
              title={
                <>
                  Compras <span className="font-normal text-ink-600 tabular-nums">· {user.purchases.length}</span>
                </>
              }
              caption="Compras"
              head={["Fecha", "Estado", <span key="t" className="block text-right">Total</span>, "Evento"]}
              mobileHide={[0]}
              mobileCards
              empty={user.purchases.length === 0 ? "Sin compras." : undefined}
            >
              {user.purchases.map((purchase) => (
                <tr key={purchase.id}>
                  <td className="px-3 py-2.5 whitespace-nowrap text-ink-800 tabular-nums">{formatDate(purchase.createdAt, true)}</td>
                  <td className="px-3 py-2.5">
                    <span className="flex flex-wrap gap-1">
                      {purchase.courtesy ? <Badge>Cortesía</Badge> : <PaymentStatusBadge status={purchase.status} />}
                    </span>
                    <p className="mt-0.5 text-xs whitespace-nowrap text-ink-600 tabular-nums sm:hidden">{formatDate(purchase.createdAt, true)}</p>
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">{purchase.totalCents === null ? <Nil /> : formatMxn(purchase.totalCents)}</td>
                  <td className="px-3 py-2.5">
                    {purchase.eventId ? (
                      <Link href={`/eventos/${purchase.eventId}`} className="text-[13px] font-medium text-gold-800 underline-offset-[3px] hover:underline max-sm:-my-2.5 max-sm:inline-flex max-sm:min-h-11 max-sm:items-center">
                        Ver evento
                      </Link>
                    ) : (
                      <Nil label="Sin evento" />
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          </div>

          {(canEditRole || canResetFreePlan || canDelete) && (
            <section id="acciones" aria-labelledby="account-actions" className="rounded-lg border border-ink-150 bg-surface">
              <h2 id="account-actions" className="border-b border-ink-150 px-4 py-3 text-base font-semibold text-ink-950">
                Acciones de cuenta
              </h2>
              <UserSuperTools
                userId={user.id}
                email={user.email}
                role={user.adminRole}
                isSelf={user.id === admin.userId}
                freePlanUsed={user.freePlanUsed}
                canEditRole={canEditRole}
                canResetFreePlan={canResetFreePlan}
                canDelete={canDelete}
              />
            </section>
          )}
        </div>
      </div>
    </>
  );
}
