"use client";

import { useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { saveRecurringExpense, type RecurringInput } from "@/app/(admin)/gastos/actions";
import { EXPENSE_CATEGORIES, formatMxn, parsePesosToCents } from "@/lib/format";
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

/** Alta y edición de una suscripción o servicio que se cobra cada mes o cada año. */
export function RecurringExpenseForm({ id, initial }: { id: string | null; initial: RecurringInput }) {
  const [values, setValues] = useState(initial);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const reasonRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const set = (key: keyof RecurringInput) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));
  const subtotalCents = parsePesosToCents(values.subtotal);
  const taxCents = values.tax.trim() ? parsePesosToCents(values.tax) : 0;
  // Solo vista previa: el total real lo calcula la BD (subtotal + IVA).
  const total = subtotalCents !== null && values.subtotal.trim() && taxCents !== null ? subtotalCents + taxCents : null;
  const reasonError = error !== null && reason.trim().length < 3;

  return (
    <form
      className="max-w-3xl rounded-lg border border-ink-150 bg-surface"
      onSubmit={(event) => {
        event.preventDefault();
        if (reason.trim().length < 3) {
          setError("Escribe el motivo, mínimo 3 caracteres. Se guarda en Actividad.");
          reasonRef.current?.focus();
          return;
        }
        setError(null);
        startTransition(async () => {
          // Si todo sale bien, la acción redirige a la lista.
          const result = await saveRecurringExpense(id, values, reason);
          if (!result.ok) setError(result.message);
        });
      }}
    >
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 md:p-6">
        <Labeled label="Servicio o concepto" wide>
          <input required maxLength={300} value={values.concept} onChange={set("concept")} placeholder="Ej.: Vercel Pro" className={cn(ui.field, "max-md:h-11")} />
        </Labeled>
        <Labeled label="Categoría">
          <Select required value={values.category} onChange={set("category")} className="w-full sm:max-w-sm">
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
          </Select>
        </Labeled>
        <Labeled label="Proveedor">
          <input maxLength={200} value={values.vendor} onChange={set("vendor")} className={cn(ui.field, "max-md:h-11")} />
        </Labeled>
        <Labeled label="Subtotal por cobro (MXN)" hint="Sin IVA.">
          <input
            required
            inputMode="decimal"
            value={values.subtotal}
            onChange={set("subtotal")}
            placeholder="0.00"
            className={cn(ui.field, "max-md:h-11 text-right tabular-nums")}
          />
        </Labeled>
        <Labeled label="IVA por cobro (MXN)" hint="Vacío si la factura no trae IVA.">
          <input inputMode="decimal" value={values.tax} onChange={set("tax")} placeholder="0.00" className={cn(ui.field, "max-md:h-11 text-right tabular-nums")} />
        </Labeled>
        <p className="flex items-baseline justify-between gap-4 rounded-md bg-surface-2 px-3 py-2 text-sm sm:col-span-2" aria-live="polite">
          <span className="text-ink-600">Total por cobro con IVA</span>
          <span className="font-semibold text-ink-950 tabular-nums">{total === null ? <Nil /> : formatMxn(total)}</span>
        </p>
        <Labeled label="Se cobra">
          <Select value={values.periodicity} onChange={set("periodicity")} className="w-full sm:max-w-sm">
            <option value="mensual">Cada mes</option>
            <option value="anual">Cada año</option>
          </Select>
        </Labeled>
        <Labeled label="Método de pago">
          <input maxLength={100} value={values.paymentMethod} onChange={set("paymentMethod")} placeholder="Ej.: Tarjeta empresarial" className={cn(ui.field, "max-md:h-11")} />
        </Labeled>
        <Labeled label="Fecha de inicio" hint="Desde cuándo se tiene el servicio.">
          <input type="date" lang="es-MX" required value={values.startDate} onChange={set("startDate")} className={cn(ui.field, "max-md:h-11 w-full min-w-0")} />
        </Labeled>
        <Labeled
          label="Próxima fecha de cobro"
          hint="Desde aquí se registra cada cobro como gasto en su fecha. Lo anterior no se rellena: regístralo a mano si hace falta."
        >
          <input type="date" lang="es-MX" required value={values.nextChargeDate} onChange={set("nextChargeDate")} className={cn(ui.field, "max-md:h-11 w-full min-w-0")} />
        </Labeled>
        <Labeled label="Notas" wide>
          <textarea rows={2} maxLength={2000} value={values.notes} onChange={set("notes")} className={cn(ui.field, "h-auto py-2")} />
        </Labeled>
      </div>
      <div className="border-t border-ink-150 p-4 md:px-6">
        <Labeled label="Motivo" hint="Obligatorio. Queda en Actividad." wide>
          <input
            ref={reasonRef}
            required
            minLength={3}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={id ? "Ej.: subió el precio del plan" : "Ej.: contratamos el plan anual"}
            aria-invalid={reasonError ? true : undefined}
            aria-describedby={reasonError ? errorId : undefined}
            className={cn(ui.field, "max-md:h-11 aria-invalid:border-danger-700")}
          />
        </Labeled>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-ink-150 px-4 py-3 md:px-6">
        <button type="submit" disabled={pending} className={cn(ui.buttonPrimary, "max-md:w-full")}>
          {pending ? "Guardando…" : id ? "Guardar cambios" : "Registrar suscripción"}
        </button>
        <Link href="/gastos/suscripciones" className={cn(ui.buttonSecondary, "max-md:w-full")}>
          Cancelar
        </Link>
        {error && (
          <p id={errorId} role="alert" className="flex basis-full items-start gap-1.5 text-sm text-danger-700">
            <AlertCircle size={16} aria-hidden="true" className="mt-px shrink-0" />
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
