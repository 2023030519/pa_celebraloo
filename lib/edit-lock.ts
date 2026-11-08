import { createClient } from "@/lib/supabase/server";

/**
 * Candado de edición del cliente según la BD (admin_event_edit_lock usa la misma
 * private.event_content_locked que aplican los triggers). No se copia la regla
 * aquí: la copia anterior se quedó en 14 días y decía "Sin bloqueo" a eventos
 * bloqueados.
 */
export type EditLock =
  | { error: null; locked: boolean; /** Desde cuándo está bloqueado o cuándo se bloquea. */ lockAt: string | null }
  | { error: string };

export async function getEditLock(eventId: string): Promise<EditLock> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("admin_event_edit_lock", { p_event_id: eventId })
    .maybeSingle<{ locked: boolean; lock_at: string | null }>();
  if (error) {
    const missing = error.code === "PGRST202" || /could not find the function/i.test(error.message);
    return {
      error: missing
        ? "Falta aplicar la migración 20261107120000_edit_lock_state_unlock_scope_staff.sql en Supabase."
        : `No se pudo leer el bloqueo: ${error.message}`,
    };
  }
  return { error: null, locked: data?.locked ?? false, lockAt: data?.lock_at ?? null };
}

/** El desbloqueo si sigue vigente; null si no hay o ya venció. */
export function activeUnlock(unlockedUntil: string | null, now = new Date()): string | null {
  return unlockedUntil && new Date(unlockedUntil).getTime() > now.getTime() ? unlockedUntil : null;
}
