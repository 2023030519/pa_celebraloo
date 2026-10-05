"use client";

import { useState, useTransition } from "react";
import { addNote, deleteNote } from "@/app/(admin)/notas/actions";

export function NoteForm({ targetType, targetId }: { targetType: string; targetId: string }) {
  const [body, setBody] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await addNote(targetType, targetId, body);
          setMessage({ ok: result.ok, text: result.message });
          if (result.ok) setBody("");
        });
      }}
    >
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={2}
        maxLength={5000}
        placeholder="Agregar una nota interna…"
        aria-label="Nueva nota"
        className="w-full rounded-md border border-ink-250 bg-surface px-3 py-2 outline-none focus:border-gold-600 focus:ring-2 focus:ring-gold-600/30"
      />
      <div className="flex items-center gap-3">
        <button
          disabled={pending || !body.trim()}
          className="h-8 rounded-md bg-ink-950 px-3 text-xs font-semibold text-surface hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Guardando…" : "Agregar nota"}
        </button>
        {message && <span className={message.ok ? "text-xs text-ok-700" : "text-xs text-danger-700"}>{message.text}</span>}
      </div>
    </form>
  );
}

export function DeleteNoteButton({ noteId }: { noteId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="font-semibold hover:text-danger-700">
        Borrar
      </button>
    );
  }
  return (
    <span className="flex gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => void (await deleteNote(noteId)))}
        className="font-semibold text-danger-700"
      >
        {pending ? "Borrando…" : "Confirmar"}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="font-semibold">
        Cancelar
      </button>
    </span>
  );
}
