"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type ActionResult = { ok: boolean; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNLOCK_DAYS = new Set([1, 3, 7]);
const INVITATION_BUCKET = "invitation-assets";
const ALBUM_BUCKET = "event-album-photos";
const LIST_PAGE = 1000;

/**
 * Herramientas de superadmin sobre un evento. Van por RPC con la sesión del
 * superadmin: la BD vuelve a validar el rol y guarda la acción en
 * admin_audit_log.
 */
function friendlyError(error: { code?: string; message: string }): string {
  if (error.code === "42501") return "Solo un superadmin puede hacer esto.";
  if (error.code === "P0002") return "El evento ya no existe.";
  if (error.code === "22023" && /confirmation/.test(error.message)) return "El nombre no coincide. Escríbelo exactamente igual.";
  if (error.code === "22023" && /reason/.test(error.message)) return "Escribe un motivo (mínimo 3 caracteres).";
  if (error.code === "PGRST202" || /could not find the function/i.test(error.message)) {
    return "Falta aplicar la migración 20260929160000_super_admin_tools.sql en Supabase.";
  }
  return error.message;
}

async function guard(eventId: string): Promise<string | null> {
  const admin = await requireAdmin();
  if (!admin.isSuperAdmin) return "Solo un superadmin puede hacer esto.";
  if (!UUID.test(eventId)) return "Evento no válido.";
  return null;
}

/** days null = quitar el desbloqueo (vuelve la regla normal). */
export async function setEditUnlock(eventId: string, days: number | null, reason: string): Promise<ActionResult> {
  const denied = await guard(eventId);
  if (denied) return { ok: false, message: denied };
  if (days !== null && !UNLOCK_DAYS.has(days)) return { ok: false, message: "Duración no válida." };

  const until = days === null ? null : new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_event_edit_unlock", {
    p_event_id: eventId,
    p_until: until,
    p_reason: reason.trim(),
  });
  if (error) return { ok: false, message: friendlyError(error) };
  refresh();
  return { ok: true, message: days === null ? "Bloqueo restablecido." : `Edición desbloqueada por ${days} ${days === 1 ? "día" : "días"}.` };
}

async function removeFolder(bucket: string, prefix: string): Promise<boolean> {
  const service = createServiceRoleClient();
  for (;;) {
    const { data, error } = await service.storage.from(bucket).list(prefix, { limit: LIST_PAGE });
    if (error) return false;
    const paths = (data ?? []).filter((item) => item.id).map((item) => `${prefix}/${item.name}`);
    if (paths.length === 0) return true;
    const { error: removeError } = await service.storage.from(bucket).remove(paths);
    if (removeError) return false;
    if (paths.length < LIST_PAGE) return true;
  }
}

/**
 * Borrado permanente. Igual que la Zona de peligro de Celebraloo: primero la
 * RPC y después, de mejor esfuerzo, los archivos de Storage (el borrado en
 * cascada no los toca y sin el evento ya no se sabría qué carpetas eran suyas).
 */
export async function deleteEvent(eventId: string, confirmName: string, reason: string): Promise<ActionResult> {
  const denied = await guard(eventId);
  if (denied) return { ok: false, message: denied };

  const service = createServiceRoleClient();
  const { data: projects, error: projectsError } = await service
    .from("invitation_projects")
    .select("id")
    .eq("event_id", eventId);
  if (projectsError) return { ok: false, message: projectsError.message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_event", {
    p_event_id: eventId,
    p_confirm_name: confirmName,
    p_reason: reason.trim(),
  });
  if (error) return { ok: false, message: friendlyError(error) };

  const results = await Promise.all([
    removeFolder(ALBUM_BUCKET, eventId),
    ...(projects ?? []).map((project) => removeFolder(INVITATION_BUCKET, project.id as string)),
  ]).catch(() => [false]);
  if (results.some((ok) => !ok)) console.error("[admin-delete-event] Quedaron archivos sin borrar en Storage", { eventId });

  redirect("/eventos");
}
