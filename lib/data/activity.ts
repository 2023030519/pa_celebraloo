import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getEmailMap } from "@/lib/data/users";
import { formatMxn, formatValue } from "@/lib/data/catalog";

export type ActivityRow = {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  /** Ruta del panel del objetivo, si existe. */
  href: string | null;
  detail: string;
  reason: string | null;
};

const LIMIT = 200;

const ACTION_LABEL: Record<string, string> = {
  "role.change": "Cambio de rol",
  "catalog.update": "Catálogo",
  "free_plan.reset": "Plan gratis devuelto",
  "event.unlock": "Edición desbloqueada",
  "event.relock": "Edición bloqueada de nuevo",
  "event.delete": "Evento borrado",
  "account.disable": "Cuenta deshabilitada",
  "account.enable": "Cuenta habilitada",
  "account.delete": "Cuenta borrada",
  // Registradas por trigger en la BD (migración 20261001100000).
  "admin_expenses.insert": "Gasto registrado",
  "admin_expenses.update": "Gasto editado",
  "admin_expenses.delete": "Gasto borrado",
  "admin_settings.update": "Configuración cambiada",
  "admin_set_aside_rules.insert": "Apartado creado",
  "admin_set_aside_rules.update": "Apartado editado",
  "admin_set_aside_rules.delete": "Apartado borrado",
};

const ROLE_LABEL: Record<string, string> = { superadmin: "Superadmin", admin: "Admin", none: "Ninguno" };

type CatalogSnapshot = { name?: string; price_cents?: number | null; is_active?: boolean };

function describe(action: string, detail: Record<string, unknown> | null): string {
  if (!detail) return "";
  if (action === "role.change") {
    return `${ROLE_LABEL[String(detail.from)] ?? detail.from} → ${ROLE_LABEL[String(detail.to)] ?? detail.to}`;
  }
  if (action === "catalog.update") {
    const from = (detail.from ?? {}) as CatalogSnapshot;
    const to = (detail.to ?? {}) as CatalogSnapshot;
    const changes: string[] = [];
    if (from.name !== to.name) changes.push(`nombre “${from.name}” → “${to.name}”`);
    if (from.price_cents !== to.price_cents) changes.push(`precio ${formatMxn(from.price_cents)} → ${formatMxn(to.price_cents)}`);
    if (from.is_active !== to.is_active) changes.push(to.is_active ? "activado" : "desactivado");
    return changes.join(" · ") || "sin cambios";
  }
  if (action === "event.unlock" && typeof detail.until === "string") {
    return `hasta ${new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(detail.until))}`;
  }
  return "";
}

/**
 * Bitácora de admins: admin_audit_log (roles, catálogo, cuentas, borrados…)
 * junto con los cambios de permisos por evento (event_entitlement_grants).
 * Si falta la migración de la bitácora, se muestran solo los permisos.
 */
export async function listActivity(): Promise<{ rows: ActivityRow[]; auditAvailable: boolean }> {
  const service = createServiceRoleClient();
  const [audit, grants, staff, events, emails] = await Promise.all([
    service
      .from("admin_audit_log")
      .select("id, actor_profile_id, actor_email, action, target_type, target_id, target_label, detail, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(LIMIT),
    service
      .from("event_entitlement_grants")
      .select("id, event_id, capability_key, value_boolean, value_integer, value_text, source, reason, granted_at, granted_by_staff_id, revoked_at")
      .eq("source", "admin_override")
      .order("granted_at", { ascending: false })
      .limit(LIMIT),
    service.from("celebraloo_staff").select("id, profile_id"),
    service.from("events").select("id, name"),
    getEmailMap(),
  ]);

  const staffEmail = new Map((staff.data ?? []).map((row) => [row.id as string, emails.get(row.profile_id as string) ?? "staff"]));
  const eventName = new Map((events.data ?? []).map((row) => [row.id as string, row.name as string]));

  const auditRows: ActivityRow[] = (audit.data ?? []).map((row) => {
    const targetId = row.target_id as string | null;
    const href =
      row.target_type === "event" && targetId && eventName.has(targetId)
        ? `/eventos/${targetId}`
        : row.target_type === "user" && targetId && emails.has(targetId)
          ? `/usuarios/${targetId}`
          : row.target_type === "plan" || row.target_type === "addon"
            ? "/catalogo"
            : row.target_type === "admin_expenses" && targetId && row.action !== "admin_expenses.delete"
              ? `/gastos/${targetId}`
              : row.target_type === "admin_settings" || row.target_type === "admin_set_aside_rules"
                ? "/finanzas"
                : null;
    return {
      id: `audit:${row.id}`,
      at: row.created_at as string,
      actor: (row.actor_email as string | null) ?? emails.get(row.actor_profile_id as string) ?? "—",
      action: ACTION_LABEL[row.action as string] ?? (row.action as string),
      target: (row.target_label as string | null) ?? targetId ?? "—",
      href,
      detail: describe(row.action as string, row.detail as Record<string, unknown> | null),
      reason: row.reason as string | null,
    };
  });

  const grantRows: ActivityRow[] = (grants.data ?? []).map((row) => ({
    id: `grant:${row.id}`,
    at: row.granted_at as string,
    actor: staffEmail.get(row.granted_by_staff_id as string) ?? "—",
    action: row.revoked_at ? "Permiso (revocado después)" : "Permiso",
    target: eventName.get(row.event_id as string) ?? "Evento borrado",
    href: eventName.has(row.event_id as string) ? `/eventos/${row.event_id}` : null,
    detail: `${row.capability_key}: ${formatValue(row)}`,
    reason: row.reason as string | null,
  }));

  return {
    rows: [...auditRows, ...grantRows].sort((a, b) => b.at.localeCompare(a.at)).slice(0, LIMIT),
    auditAvailable: !audit.error,
  };
}
