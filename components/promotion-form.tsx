"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { CircleAlert, Info } from "lucide-react";
import { savePromotion, type PromotionInput } from "@/app/(admin)/promociones/actions";
import { Select, cn, ui } from "@/components/ui";

type Option = { key: string; name: string };

function Labeled({ label, hint, children, wide }: { label: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={cn("flex flex-col gap-1", wide && "sm:col-span-2")}>
      <span className="text-[13px] font-medium text-ink-800">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-600">{hint}</span>}
    </label>
  );
}

/** Bloque del formulario: título y campos, separado del siguiente por un divisor (no tarjetas anidadas). */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-ink-150 px-4 py-5 md:px-6">
      <h2 className="mb-4 text-base font-semibold text-ink-950">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
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
    <fieldset className="flex flex-col">
      <legend className="mb-1.5 text-[13px] font-medium text-ink-800">{legend}</legend>
      {options.length === 0 && <p className="text-xs text-ink-600">No hay opciones activas.</p>}
      {options.map((option) => (
        <label key={option.key} className="flex min-h-8 max-md:min-h-11 cursor-pointer items-center gap-2 text-sm text-ink-950">
          <input
            type="checkbox"
            className="size-4 accent-gold-800"
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
  disabled = false,
}: {
  id: string | null;
  initial: PromotionInput;
  plans: Option[];
  addons: Option[];
  timesRedeemed: number;
  /** El formulario no se puede enviar (p. ej. sin Stripe): la página explica por qué arriba. */
  disabled?: boolean;
}) {
  const [values, setValues] = useState(initial);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (key: keyof PromotionInput) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));
  const field = cn(ui.field, "w-full max-md:h-11");

  return (
    <form
      className="max-w-3xl rounded-lg border border-ink-150 bg-surface"
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
      <fieldset disabled={disabled} className="min-w-0">
        <Section title="Datos de la promoción">
          <Labeled label="Tipo">
            <Select value={values.kind} onChange={set("kind")} className="w-full sm:max-w-sm">
              <option value="cupon">Cupón</option>
              <option value="descuento">Descuento</option>
              <option value="lanzamiento">Promoción de lanzamiento</option>
            </Select>
          </Labeled>
          <Labeled label="Nombre interno">
            <input required maxLength={120} value={values.name} onChange={set("name")} placeholder="Ej.: Lanzamiento de otoño" className={field} />
          </Labeled>
          <Labeled label="Código" hint="Lo que el cliente escribe en la página de pago. Letras, números, - o _." wide>
            <input
              required
              maxLength={40}
              value={values.code}
              onChange={(event) => setValues((current) => ({ ...current, code: event.target.value.toUpperCase().replace(/\s/g, "") }))}
              placeholder="OTONO20"
              className={cn(field, "font-mono uppercase sm:max-w-xs")}
            />
          </Labeled>
        </Section>
  
        <Section title="Descuento y vigencia">
          <Labeled label="Descuento">
            <Select value={values.discountType} onChange={set("discountType")} className="w-full sm:max-w-sm">
              <option value="percent">Porcentaje</option>
              <option value="amount">Monto fijo (MXN)</option>
            </Select>
          </Labeled>
          <Labeled label={values.discountType === "percent" ? "Porcentaje (%)" : "Monto (MXN)"} hint="Se aplica una vez, en la compra.">
            <input
              required
              inputMode="decimal"
              value={values.value}
              onChange={set("value")}
              placeholder={values.discountType === "percent" ? "20" : "100.00"}
              className={cn(field, "text-right tabular-nums")}
            />
          </Labeled>
          <Labeled label="Inicio" hint="Hora de Ciudad de México. Antes de esta fecha el código no funciona.">
            <input type="datetime-local" lang="es-MX" required value={values.startsAt} onChange={set("startsAt")} className={cn(field, "tabular-nums")} />
          </Labeled>
          <Labeled label="Expiración" hint="Vacío = sin fecha de fin.">
            <input type="datetime-local" lang="es-MX" value={values.expiresAt} onChange={set("expiresAt")} className={cn(field, "tabular-nums")} />
          </Labeled>
          <Labeled
            label="Máximo de usos"
            hint={timesRedeemed > 0 ? `Vacío = sin límite. Ya se usó ${timesRedeemed} ${timesRedeemed === 1 ? "vez" : "veces"}.` : "Vacío = sin límite."}
          >
            <input inputMode="numeric" value={values.maxRedemptions} onChange={set("maxRedemptions")} className={cn(field, "text-right tabular-nums")} />
          </Labeled>
        </Section>
  
        <Section title="Aplica a">
          <Checklist legend="Planes" options={plans} selected={values.plans} onChange={(next) => setValues((current) => ({ ...current, plans: next }))} />
          <Checklist
            legend="Complementos"
            options={addons}
            selected={values.addons}
            onChange={(next) => setValues((current) => ({ ...current, addons: next }))}
          />
        </Section>
  
        <div className="flex flex-col gap-4 rounded-b-lg bg-surface-2/50 px-4 py-5 md:px-6">
          {id && (
            <p className="flex items-start gap-2 rounded-md border border-info-300 bg-info-100 px-3 py-2.5 text-[13px] text-info-700">
              <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              Stripe no permite editar un cupón: si cambias el código, el descuento, la vigencia, el máximo o a qué aplica, se crea uno
              nuevo con el mismo código y el anterior se desactiva. Los usos se conservan.
            </p>
          )}
          <Labeled label="Motivo" hint="Obligatorio, mínimo 3 caracteres. Queda en Actividad.">
            <input
              required
              minLength={3}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={id ? "Ej.: ampliamos la vigencia" : "Ej.: campaña de Instagram de octubre"}
              className={field}
            />
          </Labeled>
          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-md border border-danger-300 bg-danger-100 px-3 py-2.5 text-sm text-danger-700">
              <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
          {/* M3: en móvil, enviar y cancelar a todo el ancho. */}
          <div className="flex flex-wrap gap-2 max-md:flex-col">
            <button disabled={pending || reason.trim().length < 3} className={ui.buttonPrimary}>
              {pending ? "Guardando en Stripe…" : id ? "Guardar cambios" : "Crear promoción"}
            </button>
            {/* Un enlace no se deshabilita con el fieldset: Cancelar sigue funcionando. */}
            <Link href="/promociones" className={ui.buttonSecondary}>
              Cancelar
            </Link>
          </div>
        </div>
      </fieldset>
    </form>
  );
}
