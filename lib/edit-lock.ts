/**
 * Copia de la regla de Celebraloo (lib/dashboard/edit-lock.ts y
 * private.event_edit_locked): a 14 días del evento (hora de CDMX) se bloquea
 * la edición, salvo 72 h de gracia desde que se creó o un desbloqueo de
 * superadmin. Aquí solo se usa para mostrar el estado; quien decide es la BD.
 */
const LOCK_DAYS = 14;
const GRACE_HOURS = 72;

export function isEditLocked(
  eventDate: string | null,
  createdAt: string,
  unlockedUntil: string | null,
  now = new Date()
): boolean {
  if (!eventDate) return false;
  const lockStart = new Date(`${eventDate}T00:00:00Z`);
  lockStart.setUTCDate(lockStart.getUTCDate() - LOCK_DAYS);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(now);
  const inGrace = now.getTime() - new Date(createdAt).getTime() < GRACE_HOURS * 60 * 60 * 1000;
  const unlocked = unlockedUntil ? new Date(unlockedUntil).getTime() > now.getTime() : false;
  return today >= lockStart.toISOString().slice(0, 10) && !inGrace && !unlocked;
}

/** El desbloqueo si sigue vigente; null si no hay o ya venció. */
export function activeUnlock(unlockedUntil: string | null, now = new Date()): string | null {
  return unlockedUntil && new Date(unlockedUntil).getTime() > now.getTime() ? unlockedUntil : null;
}
