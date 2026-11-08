"use client";

import { useId, useState, useTransition } from "react";
import { CircleAlert, CircleCheck, Info, Trash2 } from "lucide-react";
import { deleteRule, saveRule, saveSettings, type RuleInput, type SettingsInput } from "@/app/(admin)/configuracion/actions";
import { Select, cn, ui } from "@/components/ui";

type Message = { ok: boolean; text: string } | null;

// El navegador marca en rojo lo que no cumple min/max/step/pattern (después de tocarlo); el servidor repite la validación.
const invalid = "user-invalid:border-danger-700";
const field = cn(ui.field, "w-full max-md:h-11", invalid);
const label = "text-[13px] font-medium text-ink-800";

/** Siempre montado (sr-only si está vacío) para que el lector anuncie cada mensaje nuevo. */
function Feedback({ message, className }: { message: Message; className?: string }) {
  const Icon = message?.ok ? CircleCheck : CircleAlert;
  return (
    <span
      role="status"
      className={message ? cn("inline-flex items-start gap-1.5 text-[13px]", message.ok ? "text-ok-700" : "text-danger-700", className) : "sr-only"}
    >
      {message && (
        <>
          <Icon size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
          {message.text}
        </>
      )}
    </span>
  );
}

function Labeled({ text, hint, children, wide }: { text: string; hint?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={cn("flex flex-col gap-1", wide && "sm:col-span-2")}>
      <span className={label}>{text}</span>
      {children}
      {hint && <span className="text-xs text-ink-600">{hint}</span>}
    </label>
  );
}

/** Motivo visible con etiqueta y pista, como pide la bitácora. */
function ReasonField({ value, onChange, className }: { value: string; onChange: (value: string) => void; className?: string }) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className={label}>
        Motivo
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={500}
        aria-describedby={`${id}-hint`}
        className={cn(ui.field, "w-full max-md:h-11")}
      />
      <span id={`${id}-hint`} className="text-xs text-ink-600">
        Obligatorio, mínimo 3 caracteres. Queda en Actividad junto con el cambio.
      </span>
    </div>
  );
}

const same = <T,>(a: T, b: T) => JSON.stringify(a) === JSON.stringify(b);

export function SettingsForm({ initial }: { initial: SettingsInput }) {
  const [saved, setSaved] = useState(initial);
  const [values, setValues] = useState(initial);
  const [valid, setValid] = useState(true);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<Message>(null);
  const [pending, startTransition] = useTransition();
  const set = (key: keyof SettingsInput) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));
  const dirty = !same(values, saved);

  return (
    <form
      onChange={(event) => setValid(event.currentTarget.checkValidity())}
      onSubmit={(event) => {
        event.preventDefault();
        setMessage(null);
        startTransition(async () => {
          const result = await saveSettings(values, reason);
          setMessage({ ok: result.ok, text: result.message });
          if (result.ok) {
            setSaved(values);
            setReason("");
          }
        });
      }}
    >
      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <p className="flex items-start gap-2 rounded-md bg-info-100 px-3 py-2 text-[13px] text-info-700 sm:col-span-2">
          <Info size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
          Correo de soporte, nombre comercial, razón social, RFC y domicilio todavía no se usan: los correos y los textos legales de la app no los
          toman de aquí.
        </p>
        <Labeled text="Correo de soporte">
          <input type="email" maxLength={254} value={values.supportEmail} onChange={set("supportEmail")} className={field} />
        </Labeled>
        <Labeled text="Nombre comercial">
          <input required maxLength={120} value={values.companyName} onChange={set("companyName")} className={field} />
        </Labeled>
        <Labeled text="Razón social">
          <input maxLength={200} value={values.companyLegalName} onChange={set("companyLegalName")} className={field} />
        </Labeled>
        <Labeled text="RFC" hint="12 caracteres (persona moral) o 13 (física).">
          <input
            value={values.companyRfc}
            onChange={set("companyRfc")}
            maxLength={13}
            pattern="[A-Za-zÑñ&]{3,4}[0-9]{6}[A-Za-z0-9]{3}"
            title="12 caracteres (persona moral) o 13 (física), p. ej. ABC010203XY1"
            className={cn(field, "uppercase")}
          />
        </Labeled>
        <Labeled text="Domicilio" wide>
          <textarea rows={2} maxLength={500} value={values.companyAddress} onChange={set("companyAddress")} className={cn(ui.field, "h-auto w-full py-2", invalid)} />
        </Labeled>
        <Labeled text="IVA para cálculos (%)" hint="Solo aplica a ventas nuevas: cada venta guarda la tasa con la que se cobró.">
          <input
            type="number"
            required
            min={0}
            max={100}
            step={0.01}
            value={values.ivaPercent}
            onChange={set("ivaPercent")}
            className={cn(field, "tabular-nums")}
          />
        </Labeled>
        <Labeled text="Días para “Próximo”" hint="Un evento pasa a Próximo cuando faltan estos días o menos (de 1 a 365).">
          <input
            type="number"
            required
            min={1}
            max={365}
            step={1}
            value={values.upcomingDays}
            onChange={set("upcomingDays")}
            className={cn(field, "tabular-nums")}
          />
        </Labeled>
      </div>

      {/* Barra de guardado: el motivo aparece solo con cambios pendientes. */}
      <div className="flex flex-col gap-3 rounded-b-lg border-t border-ink-150 bg-surface-2/50 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div className={cn("flex flex-col gap-2 sm:max-w-md sm:flex-1", !dirty && "sm:self-center")}>
          {dirty ? (
            <ReasonField value={reason} onChange={setReason} />
          ) : (
            !message && <span className="text-[13px] text-ink-600">Sin cambios</span>
          )}
          <Feedback message={message} />
        </div>
        <div className="flex flex-col gap-2 sm:items-end sm:pt-6">
          <button disabled={pending || !dirty || !valid || reason.trim().length < 3} className={ui.buttonPrimary}>
            {pending ? "Guardando…" : "Guardar configuración"}
          </button>
          {dirty && !valid && <span className="text-[13px] text-danger-700">Revisa los campos marcados en rojo.</span>}
        </div>
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
export function RuleEditor({ id, initial, showLabels = true }: { id: string | null; initial: RuleInput; showLabels?: boolean }) {
  const [saved, setSaved] = useState(initial);
  const [values, setValues] = useState(initial);
  const [valid, setValid] = useState(true);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<Message>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const set = (key: keyof RuleInput) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setValues((current) => ({ ...current, [key]: key === "isActive" ? (event.target as HTMLInputElement).checked : event.target.value }));
  const dirty = !same(values, saved);
  const reasonOk = reason.trim().length >= 3;
  // Solo la primera regla de la lista muestra las etiquetas; las demás las dejan para lectores de pantalla.
  const fieldLabel = showLabels ? label : "sr-only";

  return (
    <form
      aria-label={saved.name ? `Apartado ${saved.name}` : "Nuevo apartado"}
      className="flex flex-wrap items-end gap-x-2 gap-y-3 px-4 py-3"
      onChange={(event) => setValid(event.currentTarget.checkValidity())}
      onSubmit={(event) => {
        event.preventDefault();
        setMessage(null);
        startTransition(async () => {
          const result = await saveRule(id, values, reason);
          setMessage({ ok: result.ok, text: result.message });
          if (!result.ok) return;
          setReason("");
          if (id === null) setValues(initial);
          else setSaved(values);
        });
      }}
    >
      <label className="flex w-full flex-col gap-1 sm:w-auto sm:min-w-28 sm:flex-1">
        <span className={fieldLabel}>Nombre</span>
        <input required maxLength={80} value={values.name} onChange={set("name")} className={field} />
      </label>
      <label className="flex flex-col gap-1">
        <span className={fieldLabel}>Tipo</span>
        <Select value={values.kind} onChange={set("kind")} className="sm:w-40">
          <option value="percent">Porcentaje</option>
          <option value="fixed">Monto fijo al mes</option>
        </Select>
      </label>
      <label className="flex flex-col gap-1">
        <span className={fieldLabel}>{values.kind === "percent" ? "%" : "MXN / mes"}</span>
        <input
          type="number"
          required
          min={0}
          max={values.kind === "percent" ? 100 : 21_474_836.47}
          step={0.01}
          value={values.value}
          onChange={set("value")}
          // Sin w-full: el ancho fijo manda y la regla cabe en un renglón.
          className={cn(ui.field, invalid, values.kind === "percent" ? "w-20" : "w-28", "text-right tabular-nums max-md:h-11")}
        />
      </label>
      {values.kind === "percent" && (
        <label className="flex flex-col gap-1">
          <span className={fieldLabel}>Sobre</span>
          <Select value={values.base} onChange={set("base")} className="sm:w-44">
            {Object.entries(BASES).map(([key, text]) => (
              <option key={key} value={key}>
                {text}
              </option>
            ))}
          </Select>
        </label>
      )}
      {/* Activo y Borrar van juntos en el mismo renglón que los campos. */}
      <div className="flex items-center gap-2 sm:self-end">
        <label className="flex h-9 items-center gap-2 px-1 max-md:h-11 text-[13px] font-medium text-ink-800">
          <input type="checkbox" checked={values.isActive} onChange={set("isActive")} className="size-4 accent-gold-800" />
          Activo
        </label>
        {id && !confirmDelete && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 max-md:h-11 text-[13px] font-medium text-ink-600 transition-colors duration-[var(--dur-fast)] hover:bg-danger-100 hover:text-danger-700"
          >
            <Trash2 size={14} aria-hidden="true" />
            Borrar<span className="sr-only"> el apartado {saved.name}</span>
          </button>
        )}
      </div>

      {(dirty || confirmDelete) && (
        <div className="flex basis-full flex-col gap-3 rounded-md border border-ink-150 bg-surface-2/50 p-3 sm:flex-row sm:items-start">
          <ReasonField value={reason} onChange={setReason} className="sm:max-w-md sm:flex-1" />
          <div className="flex flex-wrap gap-2 sm:pt-6">
            {confirmDelete ? (
              <>
                <button
                  type="button"
                  disabled={pending || !reasonOk}
                  onClick={() =>
                    id &&
                    startTransition(async () => {
                      const result = await deleteRule(id, reason);
                      if (!result.ok) setMessage({ ok: false, text: result.message });
                    })
                  }
                  className={cn(ui.buttonDanger, "max-sm:flex-1")}
                >
                  {pending ? "Borrando…" : "Confirmar borrado"}
                </button>
                <button type="button" disabled={pending} onClick={() => setConfirmDelete(false)} className={cn(ui.buttonSecondary, "max-sm:flex-1")}>
                  Cancelar
                </button>
              </>
            ) : (
              <button disabled={pending || !valid || !reasonOk} className={cn(ui.buttonPrimary, "max-sm:flex-1")}>
                {pending ? "Guardando…" : id ? "Guardar" : "Agregar"}
              </button>
            )}
          </div>
        </div>
      )}
      <Feedback message={message} className="basis-full" />
    </form>
  );
}
