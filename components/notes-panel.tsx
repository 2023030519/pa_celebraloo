import "server-only";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { Card, Nil, formatDate } from "@/components/ui";
import { NoteForm, DeleteNoteButton } from "@/components/note-form";

type NotesTarget = { targetType: "purchase" | "customer" | "event"; targetId: string };

/**
 * Notas internas de una venta, cliente o evento. Las ve el staff con notas.write (RLS).
 * Llegan después del resto de la ficha (Suspense): la ficha no las espera.
 */
export function NotesPanel(props: NotesTarget) {
  return (
    <Suspense
      fallback={
        <Card title="Notas internas">
          <div aria-busy="true" className="flex flex-col gap-3">
            <span className="sr-only">Cargando notas…</span>
            <div className="h-20 animate-pulse rounded-md bg-surface-2" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-surface-2" />
          </div>
        </Card>
      }
    >
      <Notes {...props} />
    </Suspense>
  );
}

/** Correos de los autores (pocos: el staff), uno por uno; no la lista entera de usuarios. */
async function authorEmails(ids: string[]): Promise<Map<string, string>> {
  const service = createServiceRoleClient();
  const found = await Promise.all(ids.map((id) => service.auth.admin.getUserById(id)));
  return new Map(found.flatMap(({ data }) => (data.user?.email ? [[data.user.id, data.user.email] as const] : [])));
}

async function Notes({ targetType, targetId }: NotesTarget) {
  const supabase = await createClient();
  const { data: notes, error } = await supabase
    .from("admin_notes")
    .select("id, body, created_by, created_at")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .order("created_at", { ascending: false });
  const emails = await authorEmails([...new Set((notes ?? []).map((note) => note.created_by as string).filter(Boolean))]);

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
              <li key={note.id} className="rounded-md border border-ink-150 bg-surface-2/50 p-3">
                <p className="whitespace-pre-wrap text-ink-950">{note.body}</p>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-ink-600">
                  <span>
                    {emails.get(note.created_by as string) ?? <Nil label="Autor desconocido" />} · {formatDate(note.created_at, true)}
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
