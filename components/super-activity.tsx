import "server-only";
import Link from "next/link";
import { getActivity, type ActivityItem } from "@/lib/data/admin";
import { Badge, PageTitle, Table, formatDate } from "@/components/ui";
import { DataError } from "@/components/finance";
import { Field, FilterBar, fieldClass } from "@/components/filters";

const PAGE = 100;

const KINDS: Record<string, { label: string; tone: "neutral" | "gold" | "ok" | "danger" | "info" }> = {
  registro: { label: "Registro", tone: "info" },
  evento: { label: "Evento", tone: "neutral" },
  pago: { label: "Pago", tone: "ok" },
  pago_fallido: { label: "Pago fallido", tone: "danger" },
  pago_rechazado: { label: "Rechazado", tone: "danger" },
  reembolso: { label: "Reembolso", tone: "info" },
  contracargo: { label: "Contracargo", tone: "danger" },
  error: { label: "Error", tone: "danger" },
  permiso: { label: "Permiso", tone: "gold" },
  admin: { label: "Admin", tone: "gold" },
};

// Acciones de admin_audit_log con nombre legible.
const ADMIN_ACTIONS: Record<string, string> = {
  "role.change": "Cambio de rol",
  "catalog.update": "Catálogo editado",
  "free_plan.reset": "Plan gratis devuelto",
  "event.unlock": "Edición desbloqueada",
  "event.relock": "Edición bloqueada de nuevo",
  "event.delete": "Evento borrado",
  "account.disable": "Cuenta deshabilitada",
  "account.enable": "Cuenta habilitada",
  "account.delete": "Cuenta borrada",
  "admin_expenses.insert": "Gasto registrado",
  "admin_expenses.update": "Gasto editado",
  "admin_expenses.delete": "Gasto borrado",
  "admin_settings.update": "Configuración cambiada",
  "admin_set_aside_rules.insert": "Apartado creado",
  "admin_set_aside_rules.update": "Apartado editado",
  "admin_set_aside_rules.delete": "Apartado borrado",
};

function href(item: ActivityItem): string | null {
  if (!item.target_id) return null;
  switch (item.target_type) {
    case "customer":
    case "user":
      return `/clientes/${item.target_id}`;
    case "event":
      return item.title === "event.delete" ? null : `/eventos/${item.target_id}`;
    case "purchase":
      return `/ventas/${item.target_id}`;
    case "admin_expenses":
      return item.title === "admin_expenses.delete" ? null : `/gastos/${item.target_id}`;
    case "admin_settings":
    case "admin_set_aside_rules":
      return "/configuracion";
    case "plan":
    case "addon":
      return "/catalogo";
    default:
      return null;
  }
}

/** Actividad del Panel V1 (sección 11): une lo que ya existe, sin tabla nueva. */
export async function SuperActivity({ params }: { params: { antes?: string; tipo?: string } }) {
  const before = params.antes && !Number.isNaN(Date.parse(params.antes)) ? params.antes : null;
  const kind = params.tipo && params.tipo in KINDS ? params.tipo : null;

  let items: ActivityItem[];
  try {
    items = await getActivity(PAGE, before);
  } catch (error) {
    return (
      <>
        <PageTitle title="Actividad" />
        <DataError error={error} />
      </>
    );
  }
  // El filtro por tipo es de la página que ya se trajo (100 movimientos).
  const shown = kind ? items.filter((item) => item.kind === kind) : items;
  const oldest = items[items.length - 1]?.occurred_at;

  return (
    <>
      <PageTitle
        title="Actividad"
        subtitle="Registros, eventos, pagos, fallidos, reembolsos, contracargos, errores de Stripe y acciones de admins."
      />
      <FilterBar resetHref="/actividad">
        <Field label="Tipo">
          <select name="tipo" defaultValue={kind ?? ""} className={fieldClass}>
            <option value="">Todos</option>
            {Object.entries(KINDS).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label}
              </option>
            ))}
          </select>
        </Field>
        {before && <input type="hidden" name="antes" value={before} />}
      </FilterBar>
      <Table head={["Fecha", "Tipo", "Qué pasó", "Detalle", "Quién"]} empty={shown.length === 0 ? "Sin movimientos." : undefined}>
        {shown.map((item, index) => {
          const meta = KINDS[item.kind] ?? { label: item.kind, tone: "neutral" as const };
          const link = href(item);
          const title = item.kind === "admin" ? ADMIN_ACTIONS[item.title] ?? item.title : item.title;
          return (
            <tr key={`${item.occurred_at}-${item.kind}-${item.target_id}-${index}`} className="align-top hover:bg-paper">
              <td className="px-3 py-2.5 whitespace-nowrap text-ink-600">{formatDate(item.occurred_at, true)}</td>
              <td className="px-3 py-2.5">
                <Badge tone={meta.tone}>{meta.label}</Badge>
              </td>
              <td className="px-3 py-2.5 font-medium">
                {link ? (
                  <Link href={link} className="hover:underline">
                    {title}
                  </Link>
                ) : (
                  title
                )}
              </td>
              <td className="px-3 py-2.5 text-ink-800">{item.detail ?? "—"}</td>
              <td className="px-3 py-2.5 text-ink-600">{item.actor ?? "—"}</td>
            </tr>
          );
        })}
      </Table>
      <nav className="mt-3 flex items-center gap-3 text-xs" aria-label="Paginación">
        {before && (
          <Link href={kind ? `/actividad?tipo=${kind}` : "/actividad"} className="rounded-md px-3 py-1.5 font-semibold hover:bg-surface">
            ← Más recientes
          </Link>
        )}
        {items.length === PAGE && oldest && (
          <Link
            href={`/actividad?antes=${encodeURIComponent(oldest)}${kind ? `&tipo=${kind}` : ""}`}
            className="rounded-md px-3 py-1.5 font-semibold hover:bg-surface"
          >
            Anteriores →
          </Link>
        )}
      </nav>
    </>
  );
}
