"use client";

import { useState, useTransition } from "react";
import { deleteRule, saveRule, saveSettings, type RuleInput, type SettingsInput } from "@/app/(admin)/configuracion/actions";
import { fieldClass } from "@/components/filters";
import { cn } from "@/components/ui";

type Message = { ok: boolean; text: string } | null;

function Feedback({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <span role="status" className={cn("text-xs", message.ok ? "text-ok-700" : "text-danger-700")}>
      {message.text}
    </span>
  );
}

function Labeled({ label, hint, children, wide }: { label: string; hint?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={cn("flex flex-col gap-1", wide && "sm:col-span-2")}>
      <span className="text-xs font-semibold text-ink-800">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-600">{hint}</span>}
    </label>
  );
}

export function SettingsForm({ initial }: { initial: SettingsInput }) {
  const [values, setValues] = useState(initial);
  const [message, setMessage] = useState<Message>(null);
  const [pending, startTransition] = useTransition();
  const set = (key: keyof SettingsInput) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        setMessage(null);
        startTransition(async () => {
          const result = await saveSettings(values);
          setMessage({ ok: result.ok, text: result.message });
        });
      }}
    >
      <Labeled label="Email de soporte">
        <input type="email" value={values.supportEmail} onChange={set("supportEmail")} className={fieldClass} />
      </Labeled>
      <Labeled label="Nombre comercial">
        <input required value={values.companyName} onChange={set("companyName")} className={fieldClass} />
      </Labeled>
      <Labeled label="Razón social">
        <input value={values.companyLegalName} onChange={set("companyLegalName")} className={fieldClass} />
      </Labeled>
      <Labeled label="RFC">
        <input value={values.companyRfc} onChange={set("companyRfc")} maxLength={13} className={cn(fieldClass, "uppercase")} />
      </Labeled>
      <Labeled label="Domicilio" wide>
        <textarea rows={2} value={values.companyAddress} onChange={set("companyAddress")} className={cn(fieldClass, "h-auto py-2")} />
      </Labeled>
      <Labeled label="IVA para cálculos (%)" hint="Solo aplica a ventas nuevas: cada venta guarda la tasa con la que se cobró.">
        <input inputMode="decimal" value={values.ivaPercent} onChange={set("ivaPercent")} className={cn(fieldClass, "tabular-nums")} />
      </Labeled>
      <Labeled label="Días para “Próximo”" hint="Un evento pasa a Próximo cuando faltan estos días o menos.">
        <input inputMode="numeric" value={values.upcomingDays} onChange={set("upcomingDays")} className={cn(fieldClass, "tabular-nums")} />
      </Labeled>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button disabled={pending} className="h-9 rounded-md bg-ink-950 px-4 font-semibold text-surface hover:bg-ink-800 disabled:opacity-40">
          {pending ? "Guardando…" : "Guardar configuración"}
        </button>
        <Feedback message={message} />
      </div>
    </form>
  );
}

const BASES: Record<string, string> = {
  ventas_sin_iva: "Ventas sin IVA",
  dinero_recibido: "Dinero recibido",
  resultado_operativo: "Resultado operativo",
};

/** Una regla de apartado (id null = nueva). */
export function RuleEditor({ id, initial }: { id: string | null; initial: RuleInput }) {
  const [values, setValues] = useState(initial);
  const [message, setMessage] = useState<Message>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const set = (key: keyof RuleInput) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setValues((current) => ({ ...current, [key]: key === "isActive" ? (event.target as HTMLInputElement).checked : event.target.value }));

  return (
    <form
      className="flex flex-wrap items-end gap-2 border-b border-ink-150 py-3 last:border-b-0"
      onSubmit={(event) => {
        event.preventDefault();
        setMessage(null);
        startTransition(async () => {
          const result = await saveRule(id, values);
          setMessage({ ok: result.ok, text: result.message });
          if (result.ok && id === null) setValues(initial);
        });
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold text-ink-600">Nombre</span>
        <input required value={values.name} onChange={set("name")} className={cn(fieldClass, "w-48")} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold text-ink-600">Tipo</span>
        <select value={values.kind} onChange={set("kind")} className={fieldClass}>
          <option value="percent">Porcentaje</option>
          <option value="fixed">Monto fijo al mes</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold text-ink-600">{values.kind === "percent" ? "%" : "MXN / mes"}</span>
        <input inputMode="decimal" value={values.value} onChange={set("value")} className={cn(fieldClass, "w-24 tabular-nums")} />
      </label>
      {values.kind === "percent" && (
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-ink-600">Sobre</span>
          <select value={values.base} onChange={set("base")} className={fieldClass}>
            {Object.entries(BASES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex h-9 items-center gap-2 text-xs font-semibold">
        <input type="checkbox" checked={values.isActive} onChange={set("isActive")} />
        Activo
      </label>
      <button disabled={pending} className="h-9 rounded-md bg-ink-950 px-3 text-xs font-semibold text-surface hover:bg-ink-800 disabled:opacity-40">
        {pending ? "Guardando…" : id ? "Guardar" : "Agregar"}
      </button>
      {id &&
        (confirmDelete ? (
          <span className="flex h-9 items-center gap-2 text-xs font-semibold">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteRule(id);
                  if (!result.ok) setMessage({ ok: false, text: result.message });
                })
              }
              className="text-danger-700"
            >
              Confirmar
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="h-9 text-xs font-semibold text-ink-800 hover:text-danger-700">
            Borrar
          </button>
        ))}
      <Feedback message={message} />
    </form>
  );
}
