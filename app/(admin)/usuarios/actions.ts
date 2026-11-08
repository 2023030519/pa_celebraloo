"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { can, NO_PERMISSION, requireAdmin } from "@/lib/auth/require-admin";
import { isAdminRole, type AdminRole } from "@/lib/auth/permissions";
import { setAccountSuspended } from "@/app/(admin)/clientes/actions";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type ActionResult = { ok: boolean; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function missingMigration(error: { code?: string; message: string }): boolean {
  return error.code === "PGRST202" || /could not find the function/i.test(error.message);
}

async function targetInfo(userId: string) {
  const service = createServiceRoleClient();
  const [{ data: auth }, { data: staff, error: staffError }, { data: profile }] = await Promise.all([
    service.auth.admin.getUserById(userId),
    service.from("celebraloo_staff").select("is_platform_admin, admin_role").eq("profile_id", userId).maybeSingle(),
    service.from("profiles").select("first_name, last_name").eq("id", userId).maybeSingle(),
  ]);
  // Cualquier rol de panel cuenta como staff con acceso (admin_role); antes
  // de la migración de roles, is_platform_admin.
  const hasPanelRole = Boolean(staff?.admin_role) || staff?.is_platform_admin === true;
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");
  return { email: auth?.user?.email ?? "", name, hasPanelRole, staffError };
}

/** Suspender o reactivar con motivo: misma acción que la ficha del cliente. */
export async function setAccountDisabled(userId: string, disabled: boolean, reason: string): Promise<ActionResult> {
  return setAccountSuspended(userId, disabled, reason);
}

function roleError(error: { code?: string; message: string }): string {
  if (error.code === "42501") return NO_PERMISSION;
  if (error.code === "55000") return "Debe quedar al menos un superadmin.";
  if (error.code === "P0002") return "Usuario no encontrado (necesita haber terminado su registro en Celebraloo).";
  if (error.code === "22023") return "Rol no válido o falta el motivo.";
  if (missingMigration(error)) return "Falta aplicar la migración 20261005100000_admin_roles_permissions.sql en Supabase.";
  return error.message;
}

/**
 * Rol del panel (o null = sin acceso). Va por RPC con la sesión de quien lo
 * cambia: la BD valida roles.write, que quede al menos un superadmin, y lo
 * registra con el motivo en Actividad.
 */
export async function setStaffRole(userId: string, role: AdminRole | null, reason: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!can(admin, "roles.write")) return { ok: false, message: NO_PERMISSION };
  if (!UUID.test(userId)) return { ok: false, message: "Usuario no válido." };
  if (role !== null && !isAdminRole(role)) return { ok: false, message: "Rol no válido." };
  if (reason.trim().length < 3) return { ok: false, message: "Escribe un motivo (mínimo 3 caracteres)." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_staff_role", { p_profile_id: userId, p_role: role, p_reason: reason.trim() });
  if (error) return { ok: false, message: roleError(error) };

  refresh();
  return { ok: true, message: role ? "Rol actualizado." : "Ya no tiene acceso al panel." };
}

/** Devuelve el recorrido gratuito a un correo (borra su registro en free_plan_claims). */
export async function resetFreePlan(email: string, reason: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!can(admin, "clientes.plan_gratis")) return { ok: false, message: NO_PERMISSION };
  if (!email.includes("@")) return { ok: false, message: "Correo no válido." };
  if (reason.trim().length < 3) return { ok: false, message: "Escribe un motivo (mínimo 3 caracteres)." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reset_free_plan", { p_email: email, p_reason: reason.trim() });
  if (error) {
    if (error.code === "42501") return { ok: false, message: NO_PERMISSION };
    if (missingMigration(error)) return { ok: false, message: "Falta aplicar la migración 20260929160000_super_admin_tools.sql en Supabase." };
    return { ok: false, message: error.message };
  }
  refresh();
  return data === true
    ? { ok: true, message: "Listo: este correo puede volver a usar el recorrido gratuito." }
    : { ok: false, message: "Este correo no había usado el recorrido gratuito." };
}

/**
 * Borra la cuenta para siempre. Solo si no es dueña de eventos: borrar
 * eventos de clientes es una decisión aparte (se hace desde cada evento).
 * Sus organizaciones vacías se borran con ella. El correo sigue marcado en
 * free_plan_claims: volver a registrarse no devuelve el plan gratis.
 */
export async function deleteAccount(userId: string, confirmEmail: string, reason: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!can(admin, "clientes.borrar")) return { ok: false, message: NO_PERMISSION };
  if (!UUID.test(userId)) return { ok: false, message: "Usuario no válido." };
  if (userId === admin.userId) return { ok: false, message: "No puedes borrar tu propia cuenta." };
  if (reason.trim().length < 3) return { ok: false, message: "Escribe un motivo (mínimo 3 caracteres)." };

  const target = await targetInfo(userId);
  if (!target.email) return { ok: false, message: "Usuario no encontrado." };
  if (confirmEmail.trim().toLowerCase() !== target.email.toLowerCase()) {
    return { ok: false, message: "El correo no coincide. Escríbelo exactamente igual." };
  }
  if (target.hasPanelRole) return { ok: false, message: "Quítale primero el rol del panel." };

  const service = createServiceRoleClient();
  const { data: owned, error: ownedError } = await service
    .from("organization_members")
    .select("organization_id")
    .eq("profile_id", userId)
    .eq("role", "owner");
  if (ownedError) return { ok: false, message: ownedError.message };
  const orgIds = (owned ?? []).map((row) => row.organization_id as string);

  let soloOrgs: string[] = [];
  if (orgIds.length > 0) {
    const [{ count: eventCount, error: eventsError }, { data: coOwners, error: coOwnersError }] = await Promise.all([
      service.from("events").select("id", { count: "exact", head: true }).in("organization_id", orgIds),
      service
        .from("organization_members")
        .select("organization_id")
        .in("organization_id", orgIds)
        .eq("role", "owner")
        .neq("profile_id", userId),
    ]);
    if (eventsError || coOwnersError) return { ok: false, message: (eventsError ?? coOwnersError)!.message };
    if ((eventCount ?? 0) > 0) {
      return { ok: false, message: `Es dueña de ${eventCount} ${eventCount === 1 ? "evento" : "eventos"}. Bórralos primero desde Eventos, o deshabilita la cuenta.` };
    }
    // Organizaciones vacías que solo eran suyas: se van con la cuenta.
    const shared = new Set((coOwners ?? []).map((row) => row.organization_id as string));
    soloOrgs = orgIds.filter((id) => !shared.has(id));
  }

  // La cuenta va primero: si Auth la rechaza, no se borró nada. Con ella se van
  // sus membresías (cascade) y el marcador de onboarding del perfil, que con
  // FK restrict impedía borrar antes su organización.
  const { error } = await service.auth.admin.deleteUser(userId);
  if (error) {
    return {
      ok: false,
      message: `No se pudo borrar: la cuenta tiene archivos o registros en eventos de otros. Deshabilítala en su lugar. (${error.message})`,
    };
  }

  const { error: orgsError } =
    soloOrgs.length > 0 ? await service.from("organizations").delete().in("id", soloOrgs) : { error: null };
  // La cuenta ya no existe: la bitácora toma correo y nombre del detalle.
  const supabase = await createClient();
  const { error: logError } = await supabase.rpc("admin_record_account_action", {
    p_user_id: userId,
    p_action: "account.delete",
    p_reason: reason.trim(),
    p_detail: { email: target.email, name: target.name || null },
  });
  const problems = [
    orgsError && `no se borraron sus organizaciones vacías (${orgsError.message})`,
    logError && `no quedó en Actividad (${logError.message})`,
  ].filter(Boolean);
  if (problems.length > 0) return { ok: false, message: `Cuenta borrada, pero ${problems.join(" y ")}.` };
  redirect("/usuarios");
}
