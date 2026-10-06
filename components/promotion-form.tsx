"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { savePromotion, type PromotionInput } from "@/app/(admin)/promociones/actions";
import { fieldClass } from "@/components/filters";
import { cn } from "@/components/ui";

type Option = { key: string; name: string };

function Labeled({ label, hint, children, wide }: { label: string; hint?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={cn("flex flex-col gap-1", wide && "sm:col-span-2")}>
      <span className="text-xs font-semibold text-ink-800">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-600">{hint}</span>}
    </label>
  );
}

function Checklist({
  legend,
  options,
  selected,
  onChange,
}: {
  legend: string;
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-xs font-semibold text-ink-800">{legend}</legend>
      {options.length === 0 && <p className="text-xs text-ink-600">No hay opciones activas.</p>}
      {options.map((option) => (
        <label key={option.key} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={selected.includes(option.key)}
            onChange={(event) =>
              onChange(event.target.checked ? [...selected, option.key] : selected.filter((key) => key !== option.key))
            }
          />
          {option.name}
        </label>
      ))}
    </fieldset>
  );
}

/** Alta y edición de un cupón. Al guardar se crea o actualiza en Stripe. */
export function PromotionForm({
  id,
  initial,
  plans,
  addons,
  timesRedeemed,
}: {
  id: string | null;
  initial: PromotionInput;
  plans: Option[];
  addons: Option[];
  timesRedeemed: number;
}) {
  const [values, setValues] = useState(initial);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (key: keyof PromotionInput) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  return (
    <form
      className="grid max-w-3xl gap-4 rounded-xl border border-ink-150 bg-surface p-4 shadow-sm sm:grid-cols-2 md:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          // Si todo sale bien, la acción redirige a la lista.
          const result = await savePromotion(id, values, reason);
          if (!result.ok) setError(result.message);
        });
      }}
    >
      <Labeled label="Tipo">
        <select value={values.kind} onChange={set("kind")} className={fieldClass}>
          <option value="cupon">Cupón</option>
          <option value="descuento">Descuento</option>
          <option value="lanzamiento">Promoción de lanzamiento</option>
        </select>
      </Labeled>
      <Labeled label="Nombre interno">
        <input required maxLength={120} value={values.name} onChange={set("name")} placeholder="Ej.: Lanzamiento de otoño" className={fieldClass} />
      </Labeled>
      <Labeled label="Código" hint="Lo que el cliente escribe en la página de pago. Letras, números, - o _." wide>
        <input
          required
          maxLength={40}
          value={values.code}
          onChange={(event) => setValues((current) => ({ ...current, code: event.target.value.toUpperCase().replace(/\s/g, "") }))}
          placeholder="OTONO20"
          className={cn(fieldClass, "font-mono uppercase")}
        />
      </Labeled>
      <Labeled label="Descuento">
        <select value={values.discountType} onChange={set("discountType")} className={fieldClass}>
          <option value="percent">Porcentaje</option>
          <option value="amount">Monto fijo (MXN)</option>
        </select>
      </Labeled>
      <Labeled label={values.discountType === "percent" ? "Porcentaje (%)" : "Monto (MXN)"} hint="Se aplica una vez, en la compra.">
        <input required inputMode="decimal" value={values.value} onChange={set("value")} placeholder={values.discountType === "percent" ? "20" : "100.00"} className={cn(fieldClass, "tabular-nums")} />
      </Labeled>
      <Labeled label="Inicio" hint="Hora de Ciudad de México. Antes de esta fecha el código no funciona.">
        <input type="datetime-local" required value={values.startsAt} onChange={set("startsAt")} className={fieldClass} />
      </Labeled>
      <Labeled label="Expiración" hint="Vacío = sin fecha de fin.">
        <input type="datetime-local" value={values.expiresAt} onChange={set("expiresAt")} className={fieldClass} />
      </Labeled>
      <Labeled
        label="Máximo de usos"
        hint={timesRedeemed > 0 ? `Vacío = sin límite. Ya se usó ${timesRedeemed} ${timesRedeemed === 1 ? "vez" : "veces"}.` : "Vacío = sin límite."}
      >
        <input inputMode="numeric" value={values.maxRedemptions} onChange={set("maxRedemptions")} className={cn(fieldClass, "tabular-nums")} />
      </Labeled>
      <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
        <Checklist legend="Planes" options={plans} selected={values.plans} onChange={(next) => setValues((current) => ({ ...current, plans: next }))} />
        <Checklist legend="Complementos" options={addons} selected={values.addons} onChange={(next) => setValues((current) => ({ ...current, addons: next }))} />
      </div>
      <Labeled label="Motivo del cambio" hint="Obligatorio. Queda en Actividad." wide>
        <input
          required
          minLength={3}
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={id ? "Ej.: ampliamos la vigencia" : "Ej.: campaña de Instagram de octubre"}
          className={fieldClass}
        />
      </Labeled>
      {id && (
        <p className="text-xs text-ink-600 sm:col-span-2">
          Stripe no permite editar un cupón: si cambias el código, el descuento, la vigencia, el máximo o a qué aplica, se crea uno
          nuevo con el mismo código y el anterior se desactiva. Los usos se conservan.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button
          disabled={pending || reason.trim().length < 3}
          className="h-9 rounded-md bg-ink-950 px-4 font-semibold text-surface hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Guardando en Stripe…" : id ? "Guardar cambios" : "Crear promoción"}
        </button>
        <Link href="/promociones" className="font-semibold text-ink-800 hover:underline">
          Cancelar
        </Link>
        {error && (
          <span role="alert" className="text-danger-700">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
