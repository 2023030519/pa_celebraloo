"use server";

import { refresh } from "next/cache";
import { requirePermission } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: boolean; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TARGETS = new Set(["purchase", "customer", "event"]);

/** Notas internas: van con la sesión de quien escribe (RLS de admin_notes). */
export async function addNote(targetType: string, targetId: string, body: string): Promise<ActionResult> {
  const admin = await requirePermission("notas.write");
  if (!TARGETS.has(targetType) || !UUID.test(targetId)) return { ok: false, message: "Destino no válido." };
  const text = body.trim();
  if (!text) return { ok: false, message: "Escribe la nota." };
  if (text.length > 5000) return { ok: false, message: "La nota es demasiado larga (máximo 5,000 caracteres)." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("admin_notes")
    .insert({ target_type: targetType, target_id: targetId, body: text, created_by: admin.userId });
  if (error) return { ok: false, message: error.message };
  refresh();
  return { ok: true, message: "Nota guardada." };
}

export async function deleteNote(noteId: string): Promise<ActionResult> {
  await requirePermission("notas.write");
  if (!UUID.test(noteId)) return { ok: false, message: "Nota no válida." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("admin_notes").delete().eq("id", noteId).select("id");
  if (error) return { ok: false, message: error.message };
  // RLS: solo quien la escribió o un superadmin.
  if (!data?.length) return { ok: false, message: "Solo quien escribió la nota (o un superadmin) puede borrarla." };
  refresh();
  return { ok: true, message: "Nota borrada." };
}
