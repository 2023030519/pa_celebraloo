import "server-only";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isAdminRole, type AdminRole } from "@/lib/auth/permissions";

export type UserRow = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  lastSignInAt: string | null;
  confirmed: boolean;
  eventCount: number;
  isStaff: boolean;
  /** Rol en el panel; null = sin acceso. */
  adminRole: AdminRole | null;
  /** Cuenta deshabilitada desde el panel (ban de Supabase Auth). */
  disabled: boolean;
};

/** Un ban con fecha futura: así marca Supabase Auth una cuenta deshabilitada. */
export function isDisabled(user: Pick<User, "banned_until">): boolean {
  return Boolean(user.banned_until && new Date(user.banned_until).getTime() > Date.now());
}

const PER_PAGE = 200;
const MAX_PAGES = 25;

/**
 * Auth no filtra por texto: se leen todas las páginas (hasta 5 000 usuarios)
 * y se filtra en memoria. De sobra para el volumen actual; si crece, pasar a
 * una vista SQL con búsqueda.
 */
export const listAuthUsers = cache(async (): Promise<User[]> => {
  const service = createServiceRoleClient();
  const users: User[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (error) throw new Error(`No se pudieron leer los usuarios: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < PER_PAGE) break;
  }
  return users;
});

/** id → email, para mostrar quién es quién en eventos, miembros y auditoría. */
export const getEmailMap = cache(async (): Promise<Map<string, string>> => {
  const users = await listAuthUsers();
  return new Map(users.map((user) => [user.id, user.email ?? ""]));
});

/**
 * shortcut: copia de private.free_plan_email_key (Celebraloo 20260929120000), que
 * no se puede llamar por PostgREST; si cambia allá, cambia aquí.
 */
function freePlanEmailKey(email: string): string {
  const [user = "", domain = ""] = email.trim().toLowerCase().split("@");
  const local = user.split("+")[0];
  return ["gmail.com", "googlemail.com"].includes(domain) ? `${local.replaceAll(".", "")}@gmail.com` : `${local}@${domain}`;
}

function fullName(profile: { first_name: string | null; last_name: string | null } | undefined): string {
  return [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");
}

type StaffRow = { profile_id: string; admin_role: AdminRole | null };

/** Sin la migración de roles (20261005100000) no existe admin_role: se deriva de los flags. */
async function readStaff(profileId?: string): Promise<StaffRow[]> {
  const service = createServiceRoleClient();
  const read = <T,>(columns: string) => {
    const query = service.from("celebraloo_staff").select(columns);
    return (profileId ? query.eq("profile_id", profileId) : query).returns<T[]>();
  };
  const { data, error } = await read<{ profile_id: string; admin_role: string | null; is_platform_admin: boolean; department: string }>(
    "profile_id, admin_role, is_platform_admin, department"
  );
  if (error?.code === "42703") {
    const legacy = await read<{ profile_id: string; is_platform_admin: boolean; is_super_admin: boolean }>(
      "profile_id, is_platform_admin, is_super_admin"
    );
    return (legacy.data ?? []).map((row) => ({
      profile_id: row.profile_id,
      admin_role: row.is_super_admin ? "superadmin" : row.is_platform_admin ? "administracion" : null,
    }));
  }
  // shortcut: copia del criterio de private.is_celebraloo_staff (20261107120000), si cambia allá cambia aquí. La fila de 'admin'/'plataforma'
  // solo existe por el rol del panel; sin rol ya no es staff (otros departamentos, p. ej. diseño, sí).
  return (data ?? [])
    .filter((row) => row.admin_role || row.is_platform_admin || !["admin", "plataforma"].includes(row.department))
    .map((row) => ({ profile_id: row.profile_id, admin_role: isAdminRole(row.admin_role) ? row.admin_role : null }));
}

export async function listUsers(query: string): Promise<UserRow[]> {
  const service = createServiceRoleClient();
  const [users, profiles, owners, events, staff] = await Promise.all([
    listAuthUsers(),
    service.from("profiles").select("id, first_name, last_name"),
    service.from("organization_members").select("profile_id, organization_id").eq("role", "owner"),
    service.from("events").select("organization_id"),
    readStaff(),
  ]);

  const profileById = new Map((profiles.data ?? []).map((profile) => [profile.id, profile]));
  // Eventos de los que es dueña: los de sus organizaciones (owner), igual que
  // borrar cuenta, "Ver como" y la ficha de clientes.
  const eventsByOrg = new Map<string, number>();
  for (const event of events.data ?? []) eventsByOrg.set(event.organization_id, (eventsByOrg.get(event.organization_id) ?? 0) + 1);
  const eventsByUser = new Map<string, number>();
  for (const owner of owners.data ?? []) {
    eventsByUser.set(owner.profile_id, (eventsByUser.get(owner.profile_id) ?? 0) + (eventsByOrg.get(owner.organization_id) ?? 0));
  }
  const staffById = new Map(staff.map((row) => [row.profile_id, row]));

  const needle = query.trim().toLowerCase();
  return users
    .map((user) => ({
      id: user.id,
      email: user.email ?? "",
      name: fullName(profileById.get(user.id)),
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at ?? null,
      confirmed: Boolean(user.email_confirmed_at),
      eventCount: eventsByUser.get(user.id) ?? 0,
      isStaff: staffById.has(user.id),
      adminRole: staffById.get(user.id)?.admin_role ?? null,
      disabled: isDisabled(user),
    }))
    .filter((row) => !needle || row.email.toLowerCase().includes(needle) || row.name.toLowerCase().includes(needle))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export type UserDetail = UserRow & {
  events: { id: string; name: string; eventType: string; eventDate: string | null; role: string; archived: boolean }[];
  purchases: { id: string; status: string; courtesy: boolean; totalCents: number | null; createdAt: string; eventId: string | null }[];
  /** Usó el recorrido gratuito (free_plan_claims). null = no se pudo saber (migración pendiente). */
  freePlanUsed: boolean | null;
};

export async function getUserDetail(userId: string): Promise<UserDetail | null> {
  const service = createServiceRoleClient();
  const { data: auth, error } = await service.auth.admin.getUserById(userId);
  if (error || !auth.user) return null;

  const [profile, memberships, owned, purchases, staff, freePlan] = await Promise.all([
    service.from("profiles").select("first_name, last_name").eq("id", userId).maybeSingle(),
    service
      .from("event_members")
      .select("role, events(id, name, event_type, event_date, archived_at)")
      .eq("profile_id", userId),
    service
      .from("organization_members")
      .select("organization_id")
      .eq("profile_id", userId)
      .eq("role", "owner")
      .then(({ data }) =>
        service
          .from("events")
          .select("id, name, event_type, event_date, archived_at")
          .in("organization_id", (data ?? []).map((row) => row.organization_id))
      ),
    service
      .from("purchases")
      .select("id, provider, payment_status, amount_total_cents, created_at, event_id")
      .eq("profile_id", userId)
      .order("created_at", { ascending: false }),
    readStaff(userId).then((rows) => rows[0] ?? null),
    // Por la llave del correo, igual que reset_free_plan: el registro queda sin
    // profile_id si la cuenta se borró y se volvió a registrar.
    service.from("free_plan_claims").select("email_key").eq("email_key", freePlanEmailKey(auth.user.email ?? "")).limit(1),
  ]);

  type EventJoin = { id: string; name: string; event_type: string; event_date: string | null; archived_at: string | null };
  const ownedEvents = (owned.data ?? []) as EventJoin[];
  const ownedIds = new Set(ownedEvents.map((event) => event.id));
  const eventRows = [
    ...ownedEvents.map((event) => ({ role: "owner", event })),
    ...(memberships.data ?? [])
      .map((row) => ({ role: row.role as string, event: row.events as unknown as EventJoin | null }))
      .filter((row): row is { role: string; event: EventJoin } => row.event !== null && !ownedIds.has(row.event.id)),
  ];

  return {
    id: auth.user.id,
    email: auth.user.email ?? "",
    name: fullName(profile.data ?? undefined),
    createdAt: auth.user.created_at,
    lastSignInAt: auth.user.last_sign_in_at ?? null,
    confirmed: Boolean(auth.user.email_confirmed_at),
    eventCount: ownedEvents.length,
    isStaff: Boolean(staff),
    adminRole: staff?.admin_role ?? null,
    disabled: isDisabled(auth.user),
    freePlanUsed: freePlan.error ? null : (freePlan.data?.length ?? 0) > 0,
    events: eventRows.map(({ role, event }) => ({
        id: event.id,
        name: event.name,
        eventType: event.event_type,
        eventDate: event.event_date,
        role,
        archived: Boolean(event.archived_at),
      })),
    purchases: (purchases.data ?? []).map((row) => ({
      id: row.id,
      status: row.payment_status,
      courtesy: row.provider === "admin_panel",
      totalCents: row.amount_total_cents,
      createdAt: row.created_at,
      eventId: row.event_id,
    })),
  };
}
