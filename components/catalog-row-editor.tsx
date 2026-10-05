"use client";

import { useState, useTransition } from "react";
import { updateCatalogItem } from "@/app/(admin)/catalogo/actions";
import { cn } from "@/components/ui";

const inputClass =
  "h-8 rounded-md border border-ink-250 bg-surface px-2 outline-none focus:border-gold-600 focus:ring-2 focus:ring-gold-600/30 disabled:opacity-50";

function centsToInput(cents: number | null): string {
  if (cents === null) return "";
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/** Una fila editable del catálogo. Guardar pide motivo (queda en Actividad). */
export function CatalogRowEditor({
  kind,
  itemKey,
  name,
  priceCents,
  isActive,
}: {
  kind: "plan" | "addon";
  itemKey: string;
  name: string;
  priceCents: number | null;
  isActive: boolean;
}) {
  const [draftName, setDraftName] = useState(name);
  const [draftPrice, setDraftPrice] = useState(centsToInput(priceCents));
  const [draftActive, setDraftActive] = useState(isActive);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = draftName !== name || draftPrice !== centsToInput(priceCents) || draftActive !== isActive;

  const save = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await updateCatalogItem(kind, itemKey, draftName, draftPrice, draftActive, reason);
      setMessage({ ok: result.ok, text: result.message });
      if (result.ok) setReason("");
    });
  };

  return (
    <tr className="align-top">
      <td className="px-3 py-2.5">
        <input value={draftName} onChange={(event) => setDraftName(event.target.value)} aria-label="Nombre" className={cn(inputClass, "w-full min-w-40")} />
        <p className="mt-1 font-mono text-[11px] text-ink-600">{itemKey}</p>
      </td>
      <td className="px-3 py-2.5">
        <span className="flex items-center gap-1">
          <span className="text-ink-600">$</span>
          <input
            value={draftPrice}
            onChange={(event) => setDraftPrice(event.target.value)}
            inputMode="decimal"
            placeholder={kind === "addon" ? "Sin precio" : "0"}
            aria-label="Precio en pesos"
            className={cn(inputClass, "w-24 tabular-nums")}
          />
        </span>
      </td>
      <td className="px-3 py-2.5">
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={draftActive} onChange={(event) => setDraftActive(event.target.checked)} />
          {draftActive ? "Activo" : "Inactivo"}
        </label>
      </td>
      <td className="px-3 py-2.5">
        {dirty ? (
          <span className="flex flex-wrap items-center gap-1.5">
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Motivo del cambio"
              aria-label="Motivo"
              className={cn(inputClass, "w-44")}
            />
            <button
              disabled={pending || reason.trim().length < 3}
              onClick={save}
              className="inline-flex h-8 items-center rounded-md bg-ink-950 px-3 text-xs font-semibold text-surface hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? "Guardando…" : "Guardar"}
            </button>
          </span>
        ) : (
          <span className="text-xs text-ink-600">Sin cambios</span>
        )}
        {message && <p className={cn("mt-1 text-xs", message.ok ? "text-ok-700" : "text-danger-700")}>{message.text}</p>}
      </td>
    </tr>
  );
}
