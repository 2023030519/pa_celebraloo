"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { can, NO_PERMISSION, requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type ActionResult = { ok: boolean; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** ~100 años: Supabase Auth no tiene "ban permanente", solo duración. */
const BAN_FOREVER = "876000h";

function cleanReason(reason: string): string | null {
  const trimmed = reason.trim();
  return trimmed.length >= 3 ? trimmed.slice(0, 500) : null;
}

function rpcError(error: { code?: string; message: string }): string {
  if (error.code === "42501") return NO_PERMISSION;
  if (error.code === "22023") return "Escribe un motivo (mínimo 3 caracteres).";
  if (error.code === "P0002") return "No se encontró el registro.";
  if (error.code === "PGRST202" || /could not find the function/i.test(error.message)) {
    return "Falta aplicar la migración 20261005150000_admin_clientes_gastos.sql en Supabase.";
  }
  return error.message;
}

/**
 * Lo que va por la API de Auth se hace con service role (solo servidor) y
 * se registra con la sesión de quien lo hizo: la BD vuelve a validar el
 * permiso y el motivo (admin_record_account_action).
 */
async function recordAccountAction(userId: string, action: string, reason: string, detail: Record<string, unknown> | null = null) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_record_account_action", {
    p_user_id: userId,
    p_action: action,
    p_reason: reason,
    p_detail: detail,
  });
  return error ? rpcError(error) : null;
}

async function hasPanelRole(userId: string): Promise<boolean> {
  const { data } = await createServiceRoleClient()
    .from("celebraloo_staff")
    .select("admin_role, is_platform_admin")
    .eq("profile_id", userId)
    .maybeSingle();
  return Boolean(data?.admin_role) || data?.is_platform_admin === true;
}

function appUrl(): string {
  return (process.env.CELEBRALOO_APP_URL?.trim() || "https://app.celebraloo.com").replace(/\/$/, "");
}

/** Reenvía el correo de confirmación de registro (solo si aún no confirma). */
export async function resendConfirmation(userId: string, reason: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!can(admin, "clientes.reenviar_confirmacion")) return { ok: false, message: NO_PERMISSION };
  if (!UUID.test(userId)) return { ok: false, message: "Cliente no válido." };
  const why = cleanReason(reason);
  if (!why) return { ok: false, message: "Escribe un motivo (mínimo 3 caracteres)." };

  const { data, error } = await createServiceRoleClient().auth.admin.getUserById(userId);
  if (error || !data.user?.email) return { ok: false, message: "Cliente no encontrado." };
  if (data.user.email_confirmed_at) return { ok: false, message: "Este cliente ya confirmó su correo." };

  // Mismo envío que hace Celebraloo al registrarse (llave pública, sin sesión).
  const publicClient = createPlainClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!.trim(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: resendError } = await publicClient.auth.resend({
    type: "signup",
    email: data.user.email,
    options: { emailRedirectTo: `${appUrl()}/auth/callback?next=${encodeURIComponent("/onboarding")}` },
  });
  if (resendError) {
    return {
      ok: false,
      message: /rate limit/i.test(resendError.message)
        ? "Supabase limitó el envío de correos por unos minutos. Intenta más tarde."
        : resendError.message,
    };
  }

  const logError = await recordAccountAction(userId, "account.resend_confirmation", why);
  refresh();
  return logError
    ? { ok: false, message: `Correo reenviado, pero no quedó en la bitácora: ${logError}` }
    : { ok: true, message: `Correo de confirmación reenviado a ${data.user.email}.` };
}

/**
 * Suspender = ban de Supabase Auth: ya no puede iniciar sesión ni renovarla
 * (una sesión abierta dura hasta que vence su token, 1 h como máximo). Sus
 * eventos e invitaciones públicas no se tocan.
 */
export async function setAccountSuspended(userId: string, suspend: boolean, reason: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!can(admin, "clientes.suspender")) return { ok: false, message: NO_PERMISSION };
  if (!UUID.test(userId)) return { ok: false, message: "Cliente no válido." };
  if (userId === admin.userId) return { ok: false, message: "No puedes suspender tu propia cuenta." };
  const why = cleanReason(reason);
  if (!why) return { ok: false, message: "Escribe un motivo (mínimo 3 caracteres)." };
  if (suspend && (await hasPanelRole(userId))) {
    return { ok: false, message: "No se puede suspender a alguien con rol en el panel. Quítale el rol primero." };
  }

  const { error } = await createServiceRoleClient().auth.admin.updateUserById(userId, {
    ban_duration: suspend ? BAN_FOREVER : "none",
    app_metadata: {
      account_status: suspend ? "disabled" : "active",
      account_status_by: admin.email,
      account_status_at: new Date().toISOString(),
    },
  });
  if (error) return { ok: false, message: error.message };

  const logError = await recordAccountAction(userId, suspend ? "account.disable" : "account.enable", why);
  refresh();
  const done = suspend ? "Cuenta suspendida." : "Cuenta reactivada.";
  return logError ? { ok: false, message: `${done} No quedó en la bitácora: ${logError}` } : { ok: true, message: done };
}

export type AssignKind = "plan" | "complemento" | "acceso_total";

/**
 * Plan, complemento o acceso total para un evento del cliente, en una sola
 * transacción (admin_assign_to_event). Crea grants admin_override con el
 * motivo; no crea compras, así que nunca cuenta como venta ni ingreso.
 */
export async function assignToEvent(input: {
  eventId: string;
  kind: AssignKind;
  itemKey: string | null;
  courtesy: boolean;
  reason: string;
  removeOthers?: boolean;
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!can(admin, input.courtesy ? "eventos.cortesia" : "eventos.asignar_plan")) return { ok: false, message: NO_PERMISSION };
  if (!UUID.test(input.eventId)) return { ok: false, message: "Elige un evento." };
  if (!["plan", "complemento", "acceso_total"].includes(input.kind)) return { ok: false, message: "Tipo no válido." };
  if (input.kind !== "acceso_total" && !input.itemKey) return { ok: false, message: "Elige qué asignar." };
  const why = cleanReason(input.reason);
  if (!why) return { ok: false, message: "Escribe un motivo (mínimo 3 caracteres)." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_assign_to_event", {
    p_event_id: input.eventId,
    p_kind: input.kind,
    p_item_key: input.kind === "acceso_total" ? null : input.itemKey,
    p_courtesy: input.courtesy,
    p_reason: why,
    p_remove_others: input.removeOthers ?? false,
  });
  if (error) return { ok: false, message: rpcError(error) };
  refresh();
  const changes = Number(data ?? 0);
  return {
    ok: true,
    message: changes === 0 ? "Ya tenía todo eso: no hubo cambios (quedó registrado)." : `Listo: ${changes} ${changes === 1 ? "cambio aplicado" : "cambios aplicados"}.`,
  };
}

/** Abre una sesión de solo lectura de 15 minutos (solo superadmin). */
export async function startViewAs(userId: string, reason: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!can(admin, "clientes.ver_como")) return { ok: false, message: NO_PERMISSION };
  if (!UUID.test(userId)) return { ok: false, message: "Cliente no válido." };
  const why = cleanReason(reason);
  if (!why) return { ok: false, message: "Escribe un motivo (mínimo 3 caracteres)." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_start_view_as", { p_user_id: userId, p_reason: why });
  if (error) return { ok: false, message: error.code === "42501" ? "No se puede ver como una cuenta de staff." : rpcError(error) };
  redirect(`/ver-como/${data as string}`);
}

export async function endViewAs(sessionId: string, customerId: string): Promise<void> {
  await requireAdmin();
  if (UUID.test(sessionId)) {
    const supabase = await createClient();
    await supabase.rpc("admin_end_view_as", { p_session_id: sessionId });
  }
  redirect(UUID.test(customerId) ? `/clientes/${customerId}` : "/clientes");
}
