import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { listActivity } from "@/lib/data/activity";
import { SuperActivity } from "@/components/super-activity";
import { PageTitle, Table, formatDate } from "@/components/ui";

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ antes?: string; tipo?: string }> }) {
  const admin = await requireAdmin();
  if (admin.isSuperAdmin) return <SuperActivity params={await searchParams} />;
  const { rows, auditAvailable } = await listActivity();

  return (
    <>
      <PageTitle
        title="Actividad"
        subtitle={
          auditAvailable
            ? "Lo que hicieron los admins: roles, catálogo, cuentas, plan gratis, desbloqueos, borrados y permisos. Últimos 200."
            : "Falta aplicar la migración 20260929160000_super_admin_tools.sql: por ahora solo se ven los cambios de permisos."
        }
      />
      <Table head={["Fecha", "Quién", "Acción", "Sobre", "Detalle", "Motivo"]} empty={rows.length === 0 ? "Sin actividad registrada." : undefined}>
        {rows.map((row) => (
          <tr key={row.id} className="align-top">
            <td className="px-3 py-2.5 whitespace-nowrap text-ink-600">{formatDate(row.at, true)}</td>
            <td className="px-3 py-2.5">{row.actor}</td>
            <td className="px-3 py-2.5 font-medium">{row.action}</td>
            <td className="px-3 py-2.5">
              {row.href ? (
                <Link href={row.href} className="hover:underline">
                  {row.target}
                </Link>
              ) : (
                row.target
              )}
            </td>
            <td className="px-3 py-2.5 text-ink-800">{row.detail || "—"}</td>
            <td className="px-3 py-2.5 text-ink-600">{row.reason ?? "—"}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
