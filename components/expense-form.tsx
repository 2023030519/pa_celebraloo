"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { saveExpense, type ExpenseInput } from "@/app/(admin)/gastos/actions";
import { EXPENSE_CATEGORIES, expenseDateRange, formatMxn, parsePesosToCents } from "@/lib/format";
import { Nil, Select, cn, ui } from "@/components/ui";

function Labeled({ label, hint, children, wide }: { label: string; hint?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1", wide && "sm:col-span-2")}>
      <span className="text-[13px] font-medium text-ink-800">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-600">{hint}</span>}
    </label>
  );
}

export function ExpenseForm({ id, initial }: { id: string | null; initial: ExpenseInput }) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const subtotalRef = useRef<HTMLInputElement>(null);
  const set = (key: keyof ExpenseInput) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));
  // Mismas reglas que el servidor (gastos/actions.ts): fecha en rango y subtotal mayor que 0.
  const range = expenseDateRange();
  const subtotalCents = parsePesosToCents(values.subtotal);
  const subtotalError = values.subtotal.trim() && !subtotalCents ? "Debe ser mayor que 0, con punto para los centavos (p. ej. 1500.50)." : null;
  const taxCents = values.tax.trim() ? parsePesosToCents(values.tax) : 0;
  // Solo vista previa: el total real lo calcula la BD (subtotal + IVA).
  const total = subtotalCents && taxCents !== null ? subtotalCents + taxCents : null;

  return (
    <form
      className="max-w-3xl rounded-lg border border-ink-150 bg-surface"
      onSubmit={(event) => {
        event.preventDefault();
        if (!subtotalCents) {
          setError(subtotalError ?? "Escribe el subtotal, mayor que 0.");
          subtotalRef.current?.focus();
          return;
        }
        setError(null);
        startTransition(async () => {
          // Si todo sale bien, la acción redirige a la lista.
          const result = await saveExpense(id, values);
          if (!result.ok) setError(result.message);
        });
      }}
    >
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 md:p-6">
        <Labeled label="Fecha">
          <input
            type="date"
            lang="es-MX"
            required
            min={range.min}
            max={range.max}
            value={values.expenseDate}
            onChange={set("expenseDate")}
            className={cn(ui.field, "max-md:h-11 w-full min-w-0 invalid:border-danger-700")}
          />
        </Labeled>
        <Labeled label="Categoría">
          <Select required value={values.category} onChange={set("category")} className="w-full sm:max-w-sm">
            <option value="" disabled>
              Elige…
            </option>
            {Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </Labeled>
        <Labeled label="Concepto" wide>
          <input required maxLength={300} value={values.concept} onChange={set("concept")} placeholder="Ej.: Vercel Pro, octubre" className={cn(ui.field, "max-md:h-11")} />
        </Labeled>
        <Labeled label="Proveedor">
          <input maxLength={200} value={values.vendor} onChange={set("vendor")} className={cn(ui.field, "max-md:h-11")} />
        </Labeled>
        <Labeled label="Método de pago">
          <input maxLength={100} value={values.paymentMethod} onChange={set("paymentMethod")} placeholder="Ej.: Tarjeta empresarial" className={cn(ui.field, "max-md:h-11")} />
        </Labeled>
        <Labeled label="Subtotal (MXN)" hint={subtotalError ?? "Sin IVA."}>
          <input
            ref={subtotalRef}
            required
            inputMode="decimal"
            value={values.subtotal}
            onChange={set("subtotal")}
            placeholder="0.00"
            aria-invalid={subtotalError ? true : undefined}
            className={cn(ui.field, "max-md:h-11 text-right tabular-nums aria-invalid:border-danger-700")}
          />
        </Labeled>
        <Labeled label="IVA (MXN)" hint="Vacío si la factura no trae IVA. El total se calcula solo.">
          <input inputMode="decimal" value={values.tax} onChange={set("tax")} placeholder="0.00" className={cn(ui.field, "max-md:h-11 text-right tabular-nums")} />
        </Labeled>
        <p className="flex items-baseline justify-between gap-4 rounded-md bg-surface-2 px-3 py-2 text-sm sm:col-span-2" aria-live="polite">
          <span className="text-ink-600">Total con IVA</span>
          <span className="font-semibold text-ink-950 tabular-nums">{total === null ? <Nil /> : formatMxn(total)}</span>
        </p>
        <Labeled label="Tipo">
          <Select value={values.expenseType} onChange={set("expenseType")} className="w-full sm:max-w-sm">
            <option value="variable">Variable</option>
            <option value="fijo">Fijo</option>
          </Select>
        </Labeled>
        <Labeled
          label="Periodicidad"
          hint={
            values.periodicity !== "unico"
              ? "Es informativa. Para que un gasto mensual o anual se registre solo cada vez que se cobra, dalo de alta en Suscripciones y servicios."
              : undefined
          }
        >
          <Select value={values.periodicity} onChange={set("periodicity")} className="w-full sm:max-w-sm">
            <option value="unico">Único</option>
            <option value="mensual">Mensual</option>
            <option value="anual">Anual</option>
          </Select>
        </Labeled>
        <Labeled label="Notas" wide>
          <textarea rows={3} maxLength={2000} value={values.notes} onChange={set("notes")} className={cn(ui.field, "h-auto py-2")} />
        </Labeled>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-ink-150 px-4 py-3 md:px-6">
        <button type="submit" disabled={pending} className={cn(ui.buttonPrimary, "max-md:w-full")}>
          {pending ? "Guardando…" : id ? "Guardar cambios" : "Registrar gasto"}
        </button>
        <Link href="/gastos" className={cn(ui.buttonSecondary, "max-md:w-full")}>
          Cancelar
        </Link>
        {error && (
          <p role="alert" className="flex basis-full items-start gap-1.5 text-sm text-danger-700">
            <AlertCircle size={16} aria-hidden="true" className="mt-px shrink-0" />
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
