import Link from "next/link";
import { can, requirePermission } from "@/lib/auth/require-admin";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { getOverview } from "@/lib/data/events";
import { listUsers } from "@/lib/data/users";
import { Badge, PageTitle, Stat, Table, formatDate } from "@/components/ui";
import { SuperDashboard } from "@/components/super-dashboard";

export default async function OverviewPage() {
  const admin = await requirePermission("inicio.read");
  // Inicio con dinero para quien ve finanzas; el resto ve operación. (Fase 2 lo unifica.)
  if (can(admin, "finanzas.read")) return <SuperDashboard />;
  const [overview, users] = await Promise.all([getOverview(), listUsers("")]);
  const recent = users.slice(0, 8);

  return (
    <>
      <PageTitle title="Resumen" subtitle="Datos en vivo de la base de Celebraloo." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Usuarios" value={overview.users} href="/clientes" />
        <Stat label="Eventos" value={overview.events} href="/eventos" />
        <Stat label="Compras pagadas" value={overview.paidPurchases} />
        <Stat label="Admins de plataforma" value={overview.admins} />
      </div>
      <h2 className="mb-2 text-[13px] font-semibold">Usuarios recientes</h2>
      <Table head={["Usuario", "Registro", "Eventos", ""]} empty={recent.length === 0 ? "Sin usuarios." : undefined}>
        {recent.map((user) => (
          <tr key={user.id} className="hover:bg-paper">
            <td className="px-3 py-2.5">
              <Link href={`/clientes/${user.id}`} className="font-medium hover:underline">
                {user.email}
              </Link>
              {user.name && <p className="text-xs text-ink-600">{user.name}</p>}
            </td>
            <td className="px-3 py-2.5 text-ink-600">{formatDate(user.createdAt)}</td>
            <td className="px-3 py-2.5 tabular-nums">{user.eventCount}</td>
            <td className="px-3 py-2.5">{user.adminRole && <Badge tone="gold">{ROLE_LABELS[user.adminRole]}</Badge>}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
