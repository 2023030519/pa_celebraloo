"use client";

import { useState, useTransition } from "react";
import { deleteExpense } from "@/app/(admin)/gastos/actions";

export function DeleteExpenseButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="text-xs font-semibold text-ink-800 hover:text-danger-700">
        Borrar
      </button>
    );
  }
  return (
    <span className="flex flex-col gap-1">
      <span className="flex gap-2 text-xs font-semibold">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteExpense(id);
              if (!result.ok) setError(result.message);
            })
          }
          className="text-danger-700"
        >
          {pending ? "Borrando…" : "Confirmar"}
        </button>
        <button type="button" onClick={() => setConfirming(false)}>
          Cancelar
        </button>
      </span>
      {error && <span className="text-xs text-danger-700">{error}</span>}
    </span>
  );
}
