import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getEmailMap } from "@/lib/data/users";
import type { CapabilityValue } from "@/lib/data/catalog";

export type Entitlement = CapabilityValue & { capability_key: string; source: string; updated_at: string };

export type Grant = CapabilityValue & {
  id: string;
  capability_key: string;
  source: string;
  reason: string | null;
  grantedAt: string;
  grantedBy: string;
  revokedAt: string | null;
  revokedReason: string | null;
};

export type EventDetail = {
  id: string;
  name: string;
  eventType: string;
  eventDate: string | null;
  style: string | null;
  city: string | null;
  state: string | null;
  createdAt: string;
  archived: boolean;
  /** Desbloqueo de edición puesto por un superadmin (null = sin excepción). */
  editUnlockedUntil: string | null;
  owner: { id: string; email: string };
  members: { profileId: string; email: string; role: string }[];
  entitlements: Entitlement[];
  grants: Grant[];
  purchases: {
    id: string;
    status: string;
    totalCents: number | null;
    createdAt: string;
    items: { type: string; key: string | null; priceCents: number | null }[];
  }[];
};

export async function getEventDetail(eventId: string): Promise<EventDetail | null> {
  const service = createServiceRoleClient();
  const { data: event, error } = await service
    .from("events")
    .select("id, name, event_type, event_date, style, city, state, created_at, created_by, archived_at")
    .eq("id", eventId)
    .maybeSingle();
  if (error || !event) return null;

  // Sin la migración 20260929160000 la columna no existe: cuenta como sin desbloqueo.
  const unlock = await service
    .from("events")
    .select("edit_unlocked_until")
    .eq("id", eventId)
    .maybeSingle<{ edit_unlocked_until: string | null }>();

  const [members, entitlements, grants, purchases, staff, emails] = await Promise.all([
    service.from("event_members").select("profile_id, role").eq("event_id", eventId),
    service
      .from("event_entitlements")
      .select("capability_key, value_boolean, value_integer, value_text, source, updated_at")
      .eq("event_id", eventId),
    service
      .from("event_entitlement_grants")
      .select(
        "id, capability_key, value_boolean, value_integer, value_text, source, reason, granted_at, granted_by_staff_id, revoked_at, revoked_reason"
      )
      .eq("event_id", eventId)
      .order("granted_at", { ascending: false })
      .limit(300),
    service
      .from("purchases")
      .select("id, payment_status, amount_total_cents, created_at, purchase_items(item_type, plan_key, addon_key, unit_price_cents)")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false }),
    service.from("celebraloo_staff").select("id, profile_id"),
    getEmailMap(),
  ]);

  const staffEmail = new Map(
    (staff.data ?? []).map((row) => [row.id as string, emails.get(row.profile_id as string) ?? "staff"])
  );

  type ItemJoin = { item_type: string; plan_key: string | null; addon_key: string | null; unit_price_cents: number | null };

  return {
    id: event.id,
    name: event.name,
    eventType: event.event_type,
    eventDate: event.event_date,
    style: event.style,
    city: event.city,
    state: event.state,
    createdAt: event.created_at,
    archived: Boolean(event.archived_at),
    editUnlockedUntil: unlock.error ? null : (unlock.data?.edit_unlocked_until ?? null),
    owner: { id: event.created_by, email: emails.get(event.created_by) ?? "" },
    members: (members.data ?? []).map((row) => ({
      profileId: row.profile_id,
      email: emails.get(row.profile_id) ?? "",
      role: row.role,
    })),
    entitlements: (entitlements.data ?? []) as Entitlement[],
    grants: (grants.data ?? []).map((row) => ({
      id: row.id,
      capability_key: row.capability_key,
      value_boolean: row.value_boolean,
      value_integer: row.value_integer,
      value_text: row.value_text,
      source: row.source,
      reason: row.reason,
      grantedAt: row.granted_at,
      grantedBy: row.source === "admin_override" ? staffEmail.get(row.granted_by_staff_id) ?? "staff" : "compra",
      revokedAt: row.revoked_at,
      revokedReason: row.revoked_reason,
    })),
    purchases: (purchases.data ?? []).map((row) => ({
      id: row.id,
      status: row.payment_status,
      totalCents: row.amount_total_cents,
      createdAt: row.created_at,
      items: ((row.purchase_items ?? []) as ItemJoin[]).map((item) => ({
        type: item.item_type,
        key: item.plan_key ?? item.addon_key,
        priceCents: item.unit_price_cents,
      })),
    })),
  };
}

export async function getOverview() {
  const service = createServiceRoleClient();
  const [events, paid, staff, emails] = await Promise.all([
    service.from("events").select("id", { count: "exact", head: true }),
    service.from("purchases").select("id", { count: "exact", head: true }).eq("payment_status", "paid"),
    service.from("celebraloo_staff").select("id", { count: "exact", head: true }).eq("is_platform_admin", true),
    getEmailMap(),
  ]);
  return {
    users: emails.size,
    events: events.count ?? 0,
    paidPurchases: paid.count ?? 0,
    admins: staff.count ?? 0,
  };
}
