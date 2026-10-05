"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { saveExpense, type ExpenseInput } from "@/app/(admin)/gastos/actions";
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

export function ExpenseForm({ id, initial }: { id: string | null; initial: ExpenseInput }) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (key: keyof ExpenseInput) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  return (
    <form
      className="grid max-w-3xl gap-4 rounded-xl border border-ink-150 bg-surface p-4 shadow-sm sm:grid-cols-2 md:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          // Si todo sale bien, la acción redirige a la lista.
          const result = await saveExpense(id, values);
          if (!result.ok) setError(result.message);
        });
      }}
    >
      <Labeled label="Fecha">
        <input type="date" required value={values.expenseDate} onChange={set("expenseDate")} className={fieldClass} />
      </Labeled>
      <Labeled label="Categoría">
        <select required value={values.category} onChange={set("category")} className={fieldClass}>
          <option value="" disabled>
            Elige…
          </option>
          {Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </Labeled>
      <Labeled label="Concepto" wide>
        <input required maxLength={300} value={values.concept} onChange={set("concept")} placeholder="Ej.: Vercel Pro — octubre" className={fieldClass} />
      </Labeled>
      <Labeled label="Proveedor">
        <input maxLength={200} value={values.vendor} onChange={set("vendor")} className={fieldClass} />
      </Labeled>
      <Labeled label="Método de pago">
        <input maxLength={100} value={values.paymentMethod} onChange={set("paymentMethod")} placeholder="Ej.: Tarjeta empresarial" className={fieldClass} />
      </Labeled>
      <Labeled label="Subtotal (MXN)" hint="Sin IVA.">
        <input required inputMode="decimal" value={values.subtotal} onChange={set("subtotal")} placeholder="0.00" className={cn(fieldClass, "tabular-nums")} />
      </Labeled>
      <Labeled label="IVA (MXN)" hint="Vacío si la factura no trae IVA. El total lo suma la base.">
        <input inputMode="decimal" value={values.tax} onChange={set("tax")} placeholder="0.00" className={cn(fieldClass, "tabular-nums")} />
      </Labeled>
      <Labeled label="Tipo">
        <select value={values.expenseType} onChange={set("expenseType")} className={fieldClass}>
          <option value="variable">Variable</option>
          <option value="fijo">Fijo</option>
        </select>
      </Labeled>
      <Labeled label="Periodicidad">
        <select value={values.periodicity} onChange={set("periodicity")} className={fieldClass}>
          <option value="unico">Único</option>
          <option value="mensual">Mensual</option>
          <option value="anual">Anual</option>
        </select>
      </Labeled>
      <Labeled label="Notas" wide>
        <textarea rows={3} maxLength={2000} value={values.notes} onChange={set("notes")} className={cn(fieldClass, "h-auto py-2")} />
      </Labeled>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button
          disabled={pending}
          className="h-9 rounded-md bg-ink-950 px-4 font-semibold text-surface hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Guardando…" : id ? "Guardar cambios" : "Registrar gasto"}
        </button>
        <Link href="/gastos" className="font-semibold text-ink-800 hover:underline">
          Cancelar
        </Link>
        {error && (
          <span role="alert" className="text-danger-700">
            {error}
          </span>
        )}
      </div>
      {values.periodicity !== "unico" && (
        <p className="text-xs text-ink-600 sm:col-span-2">
          Periodicidad es informativa: un gasto mensual se registra cada mes que se paga, para que Finanzas lo cuente en su fecha.
        </p>
      )}
    </form>
  );
}
