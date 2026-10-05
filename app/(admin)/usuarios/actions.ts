"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { requireAdmin, type AdminSession } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type ActionResult = { ok: boolean; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** ~100 años: Supabase Auth no tiene "ban permanente", solo duración. */
const BAN_FOREVER = "876000h";

function missingMigration(error: { code?: string; message: string }): boolean {
  return error.code === "PGRST202" || /could not find the function/i.test(error.message);
}

/**
 * Lo que va por la API de Auth (deshabilitar, borrar) no pasa por una RPC que
 * lo registre: se anota aquí con service role. De mejor esfuerzo: sin la
 * migración 20260929160000 la tabla no existe y la acción sigue igual.
 */
async function audit(
  admin: AdminSession,
  action: string,
  target: { id: string; label: string },
  reason: string | null,
  detail: Record<string, unknown> | null = null
) {
  const { error } = await createServiceRoleClient().from("admin_audit_log").insert({
    actor_profile_id: admin.userId,
    actor_email: admin.email,
    action,
    target_type: "user",
    target_id: target.id,
    target_label: target.label,
    detail,
    reason,
  });
  if (error) console.error("[admin-audit]", action, error.message);
}

async function targetInfo(userId: string) {
  const service = createServiceRoleClient();
  const [{ data: auth }, { data: staff, error: staffError }] = await Promise.all([
    service.auth.admin.getUserById(userId),
    service.from("celebraloo_staff").select("is_platform_admin").eq("profile_id", userId).maybeSingle(),
  ]);
  return { email: auth?.user?.email ?? "", isPlatformAdmin: staff?.is_platform_admin === true, staffError };
}

/**
 * Deshabilitar = ban de Supabase Auth: la cuenta ya no puede iniciar sesión
 * ni renovar su sesión. Una sesión abierta dura hasta que vence su token
 * (1 h como máximo). Sus eventos e invitaciones públicas no se tocan.
 * Auth no tiene RPC para esto: va con service role y queda en Actividad.
 */
export async function setAccountDisabled(userId: string, disabled: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!UUID.test(userId)) return { ok: false, message: "Usuario no válido." };
  if (userId === admin.userId) return { ok: false, message: "No puedes deshabilitar tu propia cuenta." };

  const target = await targetInfo(userId);
  if (target.staffError) return { ok: false, message: target.staffError.message };
  if (disabled && target.isPlatformAdmin) {
    return { ok: false, message: "No se puede deshabilitar a otro admin de plataforma. Quítale el permiso primero." };
  }

  const { error } = await createServiceRoleClient().auth.admin.updateUserById(userId, {
    ban_duration: disabled ? BAN_FOREVER : "none",
    app_metadata: {
      account_status: disabled ? "disabled" : "active",
      account_status_by: admin.email,
      account_status_at: new Date().toISOString(),
    },
  });
  if (error) return { ok: false, message: error.message };

  await audit(admin, disabled ? "account.disable" : "account.enable", { id: userId, label: target.email }, null);
  refresh();
  return { ok: true, message: disabled ? "Cuenta deshabilitada." : "Cuenta habilitada." };
}

export type AdminRole = "superadmin" | "admin" | "none";

function roleError(error: { code?: string; message: string }): string {
  if (error.code === "42501") return "Solo un superadmin puede cambiar roles.";
  if (error.code === "55000") return "Debe quedar al menos un superadmin.";
  if (error.code === "P0002") return "Usuario no encontrado.";
  if (error.code === "22023") return "Rol no válido. ¿Falta aplicar la migración 20260929160000_super_admin_tools.sql?";
  if (missingMigration(error)) return "Falta aplicar la migración 20260929140000_platform_super_admin.sql en Supabase.";
  return error.message;
}

/**
 * Rol del panel: ninguno, admin o superadmin. Va por RPC con la sesión del
 * superadmin: la BD valida el rol, que quede al menos un superadmin, y lo
 * registra en Actividad.
 */
export async function setAdminRole(userId: string, role: AdminRole): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin.isSuperAdmin) return { ok: false, message: "Solo un superadmin puede cambiar roles." };
  if (!UUID.test(userId)) return { ok: false, message: "Usuario no válido." };
  if (role !== "superadmin" && role !== "admin" && role !== "none") return { ok: false, message: "Rol no válido." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_platform_admin_role", { p_profile_id: userId, p_role: role });
  if (error) return { ok: false, message: roleError(error) };

  refresh();
  const label = { superadmin: "Ahora es superadmin.", admin: "Ahora es admin.", none: "Ya no tiene acceso al panel." };
  return { ok: true, message: label[role] };
}

/** Devuelve el recorrido gratuito a un correo (borra su registro en free_plan_claims). */
export async function resetFreePlan(email: string, reason: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin.isSuperAdmin) return { ok: false, message: "Solo un superadmin puede hacer esto." };
  if (!email.includes("@")) return { ok: false, message: "Correo no válido." };
  if (reason.trim().length < 3) return { ok: false, message: "Escribe un motivo (mínimo 3 caracteres)." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reset_free_plan", { p_email: email, p_reason: reason.trim() });
  if (error) {
    if (error.code === "42501") return { ok: false, message: "Solo un superadmin puede hacer esto." };
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
  if (!admin.isSuperAdmin) return { ok: false, message: "Solo un superadmin puede borrar cuentas." };
  if (!UUID.test(userId)) return { ok: false, message: "Usuario no válido." };
  if (userId === admin.userId) return { ok: false, message: "No puedes borrar tu propia cuenta." };
  if (reason.trim().length < 3) return { ok: false, message: "Escribe un motivo (mínimo 3 caracteres)." };

  const target = await targetInfo(userId);
  if (!target.email) return { ok: false, message: "Usuario no encontrado." };
  if (confirmEmail.trim().toLowerCase() !== target.email.toLowerCase()) {
    return { ok: false, message: "El correo no coincide. Escríbelo exactamente igual." };
  }
  if (target.isPlatformAdmin) return { ok: false, message: "Quítale primero el rol de admin." };

  const service = createServiceRoleClient();
  const { data: owned, error: ownedError } = await service
    .from("organization_members")
    .select("organization_id")
    .eq("profile_id", userId)
    .eq("role", "owner");
  if (ownedError) return { ok: false, message: ownedError.message };
  const orgIds = (owned ?? []).map((row) => row.organization_id as string);

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
    const soloOrgs = orgIds.filter((id) => !shared.has(id));
    if (soloOrgs.length > 0) {
      const { error } = await service.from("organizations").delete().in("id", soloOrgs);
      if (error) return { ok: false, message: error.message };
    }
  }

  const { error } = await service.auth.admin.deleteUser(userId);
  if (error) {
    return {
      ok: false,
      message: `No se pudo borrar: la cuenta tiene archivos o registros en eventos de otros. Deshabilítala en su lugar. (${error.message})`,
    };
  }

  await audit(admin, "account.delete", { id: userId, label: target.email }, reason.trim());
  redirect("/usuarios");
}
