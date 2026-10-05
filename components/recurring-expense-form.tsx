"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { saveRecurringExpense, type RecurringInput } from "@/app/(admin)/gastos/actions";
import { EXPENSE_CATEGORIES } from "@/lib/format";
import { fieldClass } from "@/components/filters";
import { cn } from "@/components/ui";

function Labeled({ label, hint, children, wide }: { label: string; hint?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={cn("flex flex-col gap-1", wide && "sm:col-span-2")}>
      <span className="text-xs font-semibold text-ink-800">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-600">{hint}</span>}
    </label>
  );
}

/** Alta y edición de una suscripción o servicio que se cobra cada mes o cada año. */
export function RecurringExpenseForm({ id, initial }: { id: string | null; initial: RecurringInput }) {
  const [values, setValues] = useState(initial);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (key: keyof RecurringInput) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  return (
    <form
      className="grid max-w-3xl gap-4 rounded-xl border border-ink-150 bg-surface p-4 shadow-sm sm:grid-cols-2 md:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          // Si todo sale bien, la acción redirige a la lista.
          const result = await saveRecurringExpense(id, values, reason);
          if (!result.ok) setError(result.message);
        });
      }}
    >
      <Labeled label="Servicio o concepto" wide>
        <input required maxLength={300} value={values.concept} onChange={set("concept")} placeholder="Ej.: Vercel Pro" className={fieldClass} />
      </Labeled>
      <Labeled label="Categoría">
        <select required value={values.category} onChange={set("category")} className={fieldClass}>
          <option value="" disabled>
            Elige…
          </option>
          {Object.entries(EXPENSE_CATEGORIES)
            .filter(([key]) => key !== "retiro")
            .map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
        </select>
      </Labeled>
      <Labeled label="Proveedor">
        <input maxLength={200} value={values.vendor} onChange={set("vendor")} className={fieldClass} />
      </Labeled>
      <Labeled label="Subtotal por cobro (MXN)" hint="Sin IVA.">
        <input required inputMode="decimal" value={values.subtotal} onChange={set("subtotal")} placeholder="0.00" className={cn(fieldClass, "tabular-nums")} />
      </Labeled>
      <Labeled label="IVA por cobro (MXN)" hint="Vacío si la factura no trae IVA.">
        <input inputMode="decimal" value={values.tax} onChange={set("tax")} placeholder="0.00" className={cn(fieldClass, "tabular-nums")} />
      </Labeled>
      <Labeled label="Se cobra">
        <select value={values.periodicity} onChange={set("periodicity")} className={fieldClass}>
          <option value="mensual">Cada mes</option>
          <option value="anual">Cada año</option>
        </select>
      </Labeled>
      <Labeled label="Método de pago">
        <input maxLength={100} value={values.paymentMethod} onChange={set("paymentMethod")} placeholder="Ej.: Tarjeta empresarial" className={fieldClass} />
      </Labeled>
      <Labeled label="Fecha de inicio" hint="Desde cuándo se tiene el servicio.">
        <input type="date" required value={values.startDate} onChange={set("startDate")} className={fieldClass} />
      </Labeled>
      <Labeled
        label="Próxima fecha de cobro"
        hint="Desde aquí se registra cada cobro como gasto en su fecha. Lo anterior no se rellena: regístralo a mano si hace falta."
      >
        <input type="date" required value={values.nextChargeDate} onChange={set("nextChargeDate")} className={fieldClass} />
      </Labeled>
      <Labeled label="Notas" wide>
        <textarea rows={2} maxLength={2000} value={values.notes} onChange={set("notes")} className={cn(fieldClass, "h-auto py-2")} />
      </Labeled>
      <Labeled label="Motivo del cambio" hint="Obligatorio. Queda en Actividad." wide>
        <input
          required
          minLength={3}
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={id ? "Ej.: subió el precio del plan" : "Ej.: contratamos el plan anual"}
          className={fieldClass}
        />
      </Labeled>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button
          disabled={pending || reason.trim().length < 3}
          className="h-9 rounded-md bg-ink-950 px-4 font-semibold text-surface hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Guardando…" : id ? "Guardar cambios" : "Registrar suscripción"}
        </button>
        <Link href="/gastos/suscripciones" className="font-semibold text-ink-800 hover:underline">
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
