"use client";

import { useState, useTransition } from "react";
import { addNote, deleteNote } from "@/app/(admin)/notas/actions";
import { cn, ui } from "@/components/ui";

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
        className="w-full rounded-md border border-ink-250 bg-surface px-3 py-2 text-sm transition-[border-color,box-shadow] duration-[var(--dur-fast)] hover:border-ink-400 focus:border-gold-600 focus:ring-2 focus:ring-gold-600/25 focus:outline-none"
      />
      <div className="flex items-center gap-3">
        <button disabled={pending || !body.trim()} className={ui.buttonPrimary}>
          {pending ? "Guardando…" : "Agregar nota"}
        </button>
        {/* Siempre montado para que el resultado se anuncie. */}
        <p role="status" className={cn("text-xs empty:hidden", message?.ok ? "text-ok-700" : "text-danger-700")}>
          {message?.text}
        </p>
      </div>
    </form>
  );
}

export function DeleteNoteButton({ noteId }: { noteId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="font-semibold hover:text-danger-700">
        Borrar
      </button>
    );
  }
  return (
    <span className="flex flex-col items-end gap-1">
      <span className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              // Sin permiso la BD no borra nada (0 filas) y la acción lo dice: hay que mostrarlo.
              const result = await deleteNote(noteId);
              setError(result.ok ? null : result.message);
            })
          }
          className="font-semibold text-danger-700"
        >
          {pending ? "Borrando…" : "Confirmar"}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          className="font-semibold"
        >
          Cancelar
        </button>
      </span>
      {error && (
        <span role="alert" className="text-danger-700">
          {error}
        </span>
      )}
    </span>
  );
}
