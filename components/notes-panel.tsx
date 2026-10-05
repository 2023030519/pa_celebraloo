import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getEmailMap } from "@/lib/data/users";
import { Card, formatDate } from "@/components/ui";
import { NoteForm, DeleteNoteButton } from "@/components/note-form";

/** Notas internas de una venta, cliente o evento. Solo las ve la superadmin (RLS). */
export async function NotesPanel({ targetType, targetId }: { targetType: "purchase" | "customer" | "event"; targetId: string }) {
  const supabase = await createClient();
  const [{ data: notes, error }, emails] = await Promise.all([
    supabase
      .from("admin_notes")
      .select("id, body, created_by, created_at")
      .eq("target_type", targetType)
      .eq("target_id", targetId)
      .order("created_at", { ascending: false }),
    getEmailMap(),
  ]);

  return (
    <Card title="Notas internas">
      {error ? (
        <p className="text-danger-700">No se pudieron leer las notas: {error.message}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <NoteForm targetType={targetType} targetId={targetId} />
          {(notes ?? []).length === 0 && <p className="text-ink-600">Sin notas todavía.</p>}
          <ul className="flex flex-col gap-2">
            {(notes ?? []).map((note) => (
              <li key={note.id} className="rounded-lg border border-ink-150 bg-paper/60 p-3">
                <p className="whitespace-pre-wrap text-ink-950">{note.body}</p>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-ink-600">
                  <span>
                    {emails.get(note.created_by as string) ?? "—"} · {formatDate(note.created_at, true)}
                  </span>
                  <DeleteNoteButton noteId={note.id as string} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
