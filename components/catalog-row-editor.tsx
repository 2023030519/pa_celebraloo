"use client";

import { useId, useState, useTransition, type ReactNode } from "react";
import { updateCatalogItem, updatePlanPrice } from "@/app/(admin)/catalogo/actions";
import { cn, ui } from "@/components/ui";

// Controles de 32 px: en una fila de tabla, 36 px la vuelven muy alta.
const inputClass = ui.fieldSm;
const saveButtonClass = ui.buttonPrimarySm;

/** Columna integer en centavos: arriba de esto Postgres rechaza el precio. */
const MAX_PESOS = 21_474_836.47;

/** Mismas reglas en el navegador que en el servidor: el campo se marca y Guardar se apaga. */
function PriceInput({
  value,
  required = false,
  label,
  onChange,
}: {
  value: string;
  required?: boolean;
  label: string;
  onChange: (value: string, valid: boolean) => void;
}) {
  return (
    <span className="flex items-center gap-1 sm:justify-end">
      <span className="text-ink-600" aria-hidden="true">
        $
      </span>
      <input
        type="number"
        min={0}
        max={MAX_PESOS}
        step={0.01}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value, event.target.validity.valid)}
        placeholder={required ? undefined : "Sin precio"}
        aria-label={label}
        className={cn(inputClass, "w-28 text-right tabular-nums invalid:border-danger-700 invalid:ring-danger-700/25")}
      />
    </span>
  );
}

function centsToInput(cents: number | null): string {
  if (cents === null) return "";
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/**
 * Una fila editable del catálogo. Guardar pide motivo (queda en Actividad).
 * Paquetes: el precio solo se muestra (priceLabel); se edita por tramo de
 * plan_prices, que es lo que cobra el checkout.
 */
export function CatalogRowEditor({
  kind,
  itemKey,
  name,
  priceCents,
  priceLabel,
  isActive,
  sellable = true,
}: {
  kind: "plan" | "addon";
  itemKey: string;
  name: string;
  priceCents: number | null;
  priceLabel?: string;
  isActive: boolean;
  /** Paquete sin precio vigente en plan_prices: el checkout lo rechazaría, no se puede activar. */
  sellable?: boolean;
}) {
  const [draftName, setDraftName] = useState(name);
  const [draftPrice, setDraftPrice] = useState(centsToInput(priceCents));
  const [priceValid, setPriceValid] = useState(true);
  const [draftActive, setDraftActive] = useState(isActive);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = draftName !== name || draftPrice !== centsToInput(priceCents) || draftActive !== isActive;
  const invalid = !draftName.trim() ? "Escribe el nombre." : !priceValid ? "Precio no válido: de 0 a 21,474,836.47, con 2 decimales." : null;

  const save = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await updateCatalogItem(kind, itemKey, draftName, draftPrice, draftActive, reason);
      setMessage({ ok: result.ok, text: result.message });
      if (result.ok) setReason("");
    });
  };

  return (
    <tr title={itemKey} className="block border-b border-ink-150 py-2 align-top sm:table-row sm:py-0">
      <td className="block px-3 py-2.5 sm:table-cell">
        <input
          required
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          aria-label={`Nombre de ${name}`}
          className={cn(inputClass, "w-full min-w-40 invalid:border-danger-700")}
        />
      </td>
      <td className={cn("block px-3 py-2.5 sm:table-cell", priceLabel === undefined && "sm:text-right")}>
        {priceLabel !== undefined ? (
          <span className="block max-w-72 pt-1.5 text-[13px] text-ink-800 tabular-nums">{priceLabel}</span>
        ) : (
          <PriceInput
            value={draftPrice}
            label="Precio en pesos"
            onChange={(value, valid) => {
              setDraftPrice(value);
              setPriceValid(valid);
            }}
          />
        )}
      </td>
      <td className="block px-3 py-2.5 sm:table-cell">
        <label className="flex min-h-8 max-md:min-h-11 items-center gap-2 text-[13px] text-ink-800">
          <input
            type="checkbox"
            className="size-4 accent-gold-800 disabled:cursor-not-allowed"
            checked={draftActive}
            disabled={!sellable && !isActive}
            onChange={(event) => setDraftActive(event.target.checked)}
          />
          {draftActive ? "Activo" : "Inactivo"}
        </label>
        {!sellable && !isActive && <p className="mt-1 text-xs text-ink-600">Sin precio vigente: no se puede activar.</p>}
      </td>
      <SaveCell dirty={dirty} invalid={invalid} pending={pending} reason={reason} setReason={setReason} onSave={save} message={message} />
    </tr>
  );
}

/** Motivo + Guardar (el motivo queda en Actividad). */
function SaveCell({
  dirty,
  invalid,
  pending,
  reason,
  setReason,
  onSave,
  message,
}: {
  dirty: boolean;
  /** Motivo por el que no se puede guardar (valor inválido). */
  invalid: string | null;
  pending: boolean;
  reason: string;
  setReason: (value: string) => void;
  onSave: () => void;
  message: { ok: boolean; text: string } | null;
}) {
  const id = useId();
  return (
    <td className="block px-3 py-2.5 sm:table-cell">
      {dirty ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={id} className="text-xs font-medium text-ink-800">
            Motivo <span className="font-normal text-ink-600">· queda en Actividad</span>
          </label>
          <span className="flex flex-wrap items-center gap-1.5">
            <input
              id={id}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Mínimo 3 caracteres"
              className={cn(inputClass, "w-44 max-sm:w-full")}
            />
            <button disabled={pending || invalid !== null || reason.trim().length < 3} onClick={onSave} className={cn(saveButtonClass, "max-sm:w-full")}>
              {pending ? "Guardando…" : "Guardar"}
            </button>
          </span>
        </div>
      ) : (
        <span className="flex min-h-8 items-center text-xs text-ink-600">Sin cambios</span>
      )}
      {dirty && invalid && <p className="mt-1 text-xs text-danger-700">{invalid}</p>}
      <p role="status" className={cn("mt-1 text-xs empty:hidden", message?.ok ? "text-ok-700" : "text-danger-700")}>
        {message?.text}
      </p>
    </td>
  );
}

/**
 * Un tramo de plan_prices: solo el precio es editable. Es lo que cobra el
 * checkout desde el siguiente pago; las vigencias se cambian por migración.
 */
export function PlanPriceEditor({
  id,
  planName,
  priceCents,
  children,
}: {
  id: string;
  planName: string;
  priceCents: number;
  /** Celdas de solo lectura: vigencia, eventos y estado. */
  children: ReactNode;
}) {
  const [draftPrice, setDraftPrice] = useState(centsToInput(priceCents));
  const [priceValid, setPriceValid] = useState(true);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await updatePlanPrice(id, draftPrice, reason);
      setMessage({ ok: result.ok, text: result.message });
      if (result.ok) setReason("");
    });
  };

  return (
    <tr className="block border-b border-ink-150 py-2 align-top sm:table-row sm:py-0">
      <td className="block px-3 py-2.5 font-medium text-ink-950 sm:table-cell sm:pt-4">{planName}</td>
      <td className="block px-3 py-2.5 sm:table-cell">
        <PriceInput
          required
          value={draftPrice}
          label={`Precio de ${planName} en pesos`}
          onChange={(value, valid) => {
            setDraftPrice(value);
            setPriceValid(valid);
          }}
        />
      </td>
      {children}
      <SaveCell
        dirty={draftPrice !== centsToInput(priceCents)}
        invalid={priceValid ? null : "Precio no válido: de 0 a 21,474,836.47, con 2 decimales."}
        pending={pending}
        reason={reason}
        setReason={setReason}
        onSave={save}
        message={message}
      />
    </tr>
  );
}
