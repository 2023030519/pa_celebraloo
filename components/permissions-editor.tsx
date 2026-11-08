"use client";

import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { AlertCircle, Check, ChevronRight, Gift, Lock, PackagePlus, PenLine, Sparkles, type LucideIcon } from "lucide-react";
import { applyAddon, applyPlan, clearCapability, grantEverything, setCapability } from "@/app/(admin)/eventos/[id]/actions";
import { Badge, HowCalculated, Select, cn, formatDate, ui, type Tone } from "@/components/ui";

type Result = { ok: boolean; message: string };

/** De dónde viene el valor efectivo de un permiso. "plan" es lo heredado; lo demás son añadidos. */
export type OriginKind = "plan" | "complemento" | "cortesia" | "excepcion" | "acceso_total";

export type EditorOrigin = {
  kind: OriginKind;
  /** Correo del staff o "compra". */
  by: string;
  at: string | null;
  /** Motivo escrito, sin la etiqueta que agrega la BD ("[plan Atelier]"). */
  reason: string | null;
  /** Plan o complemento que lo dio, si se sabe. */
  item: string | null;
};

export type EditorCapability = {
  key: string;
  name: string;
  valueType: "boolean" | "integer" | "enum";
  enumValues: string[];
  description: string | null;
  /** Valor efectivo hoy; null = el evento no lo tiene. */
  current: { label: string; raw: string; source: string } | null;
  /** null cuando el evento no lo tiene. */
  origin: EditorOrigin | null;
  /** Tiene una excepción o un complemento del panel activo: lo que "Quitar" revoca. */
  hasOverride: boolean;
};

export type EditorOption = { key: string; name: string; isActive: boolean; summary: string };

const ADDED: Record<Exclude<OriginKind, "plan">, { label: string; icon: LucideIcon; tone: Tone }> = {
  // Origen = categoría (neutral); solo la excepción, que fija el valor a mano, pide atención.
  complemento: { label: "Complemento", icon: PackagePlus, tone: "neutral" },
  cortesia: { label: "Cortesía", icon: Gift, tone: "neutral" },
  excepcion: { label: "Excepción", icon: PenLine, tone: "warn" },
  acceso_total: { label: "Acceso total", icon: Sparkles, tone: "neutral" },
};

const REASON_ERROR = "Escribe el motivo, mínimo 3 caracteres. Queda en Actividad.";

/**
 * Motivo + resultado de una acción sensible. El botón no se deshabilita por
 * falta de motivo: se valida al enviar y se enfoca el campo (la acción del
 * servidor lo vuelve a validar).
 */
export function useReasonedAction() {
  const [reason, setReasonValue] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputId = useId();

  const ready = () => {
    if (reason.trim().length >= 3) return true;
    setInvalid(true);
    setResult({ ok: false, message: REASON_ERROR });
    document.getElementById(inputId)?.focus();
    return false;
  };

  return {
    reason,
    result,
    invalid,
    pending,
    inputId,
    ready,
    setReason: (value: string) => {
      setReasonValue(value);
      if (value.trim().length >= 3) setInvalid(false);
    },
    run: (action: () => Promise<Result>) => {
      if (!ready()) return;
      setResult(null);
      startTransition(async () => {
        setResult(await action());
      });
    },
  };
}

export type ReasonedAction = ReturnType<typeof useReasonedAction>;

export function ReasonField({ state, placeholder, className }: { state: ReasonedAction; placeholder: string; className?: string }) {
  const id = state.inputId;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-ink-800">
        Motivo
      </label>
      <input
        id={id}
        value={state.reason}
        onChange={(event) => state.setReason(event.target.value)}
        maxLength={500}
        required
        placeholder={placeholder}
        aria-invalid={state.invalid || undefined}
        aria-describedby={`${id}-hint ${id}-status`}
        className={cn(ui.field, "w-full max-md:h-11", state.invalid && "border-danger-700!")}
      />
      <p id={`${id}-hint`} className="text-xs text-ink-600">
        Obligatorio. Queda en Actividad con tu nombre.
      </p>
      <p id={`${id}-status`} aria-live="polite" className="min-h-5 text-[13px]">
        {state.pending && <span className="text-ink-600">Aplicando…</span>}
        {!state.pending && state.result && (
          <span className={cn("inline-flex items-start gap-1.5", state.result.ok ? "text-ok-700" : "text-danger-700")}>
            {state.result.ok ? (
              <Check size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
            ) : (
              <AlertCircle size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
            )}
            {state.result.message}
          </span>
        )}
      </p>
    </div>
  );
}

export function PermissionsEditor({
  eventId,
  capabilities,
  plans,
  addons,
  canAssignPlan,
  plan,
}: {
  eventId: string;
  /** Aplicar plan y Acceso total: eventos.asignar_plan (la acción también lo valida). */
  canAssignPlan: boolean;
  capabilities: EditorCapability[];
  plans: EditorOption[];
  addons: EditorOption[];
  /** Plan del que se heredan los permisos y, si lo dio el panel, quién, cuándo y por qué. */
  plan: { name: string | null; note: string | null };
}) {
  const action = useReasonedAction();
  const [planKey, setPlanKey] = useState(plans.find((option) => option.key === "atelier")?.key ?? plans[0]?.key ?? "");
  const [removeOthers, setRemoveOthers] = useState(false);
  const [addonKey, setAddonKey] = useState(addons.find((addon) => addon.isActive)?.key ?? "");
  const [confirmAll, setConfirmAll] = useState(false);
  const planId = useId();
  const addonId = useId();
  const inheritedRef = useRef<HTMLDetailsElement>(null);

  // En teléfono la lista heredada empieza cerrada; en escritorio el resumen no se muestra.
  useEffect(() => {
    if (window.matchMedia("(max-width: 639px)").matches && inheritedRef.current) inheritedRef.current.open = false;
  }, []);

  const inherited = capabilities.filter((cap) => cap.origin?.kind === "plan");
  const added = capabilities.filter((cap) => cap.origin && cap.origin.kind !== "plan");
  const inactive = capabilities.filter((cap) => !cap.current);

  const row = (capability: EditorCapability) => (
    <PermissionRow
      key={`${capability.key}:${capability.current?.raw ?? ""}`}
      capability={capability}
      pending={action.pending}
      onSet={(raw: string) => action.run(() => setCapability(eventId, capability.key, raw, action.reason))}
      onClear={() => action.run(() => clearCapability(eventId, capability.key, action.reason))}
    />
  );

  return (
    <section aria-labelledby="permisos" className="@container rounded-lg border border-ink-150 bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pt-3 pb-2">
        <h2 id="permisos" className="text-base font-semibold text-ink-950">
          Permisos del evento
        </h2>
        <p className="text-[13px] text-ink-600 tabular-nums">
          {inherited.length} {plan.name ? "del plan" : "base"} · {added.length} añadidos · {inactive.length} sin activar
        </p>
      </div>
      <HowCalculated className="px-4 pb-3">
        <p>Un plan o complemento del panel suma igual que una compra, y lo que el cliente compre después se suma encima.</p>
        {canAssignPlan && (
          <>
            <p className="mt-1 font-medium text-ink-800">Aplicar plan</p>
            <p>
              Como una compra: gana el plan más alto y lo comprado se conserva. Reemplaza el plan que el panel haya dado antes. Salir de la
              prueba gratis quita “Elegir plan”.
            </p>
          </>
        )}
        <p className="mt-1 font-medium text-ink-800">Sumar complemento</p>
        <p>Suma igual que una compra: “50 invitados más” suma 50 al cupo.</p>
        {canAssignPlan && (
          <>
            <p className="mt-1 font-medium text-ink-800">Acceso total</p>
            <p>Plan Atelier + los complementos activos que Atelier no trae. Sale de la prueba gratis.</p>
          </>
        )}
      </HowCalculated>

      {/* Una sola barra: el motivo vale para todos los cambios de la sección y se queda a la vista al bajar (en móvil se apila y no se fija). */}
      <div className="flex flex-col gap-x-6 gap-y-3 border-y border-ink-150 bg-surface px-4 pt-3 pb-1 sm:flex-row sm:flex-wrap sm:items-start md:sticky md:top-0 md:z-10">
        <ReasonField state={action} placeholder="Ej.: cortesía para pruebas del equipo" className="sm:w-64" />

        {canAssignPlan ? (
          <div className="flex flex-col gap-1">
            <label htmlFor={planId} className="text-[13px] font-medium text-ink-800">
              Plan
            </label>
            <div className="flex flex-wrap gap-2">
              <Select id={planId} value={planKey} onChange={(event) => setPlanKey(event.target.value)} className="w-full sm:w-52">
                {plans.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.name}
                    {option.isActive ? "" : " (inactivo)"} · {option.summary}
                  </option>
                ))}
              </Select>
              <button
                type="button"
                disabled={action.pending || !planKey}
                onClick={() => action.run(() => applyPlan(eventId, planKey, removeOthers, action.reason))}
                className={cn(ui.buttonSecondary, "max-sm:flex-1")}
              >
                Aplicar plan
              </button>
              {!confirmAll && (
                <button
                  type="button"
                  disabled={action.pending}
                  onClick={() => action.ready() && setConfirmAll(true)}
                  title="Plan Atelier + los complementos activos que Atelier no trae."
                  className={cn(ui.buttonSecondary, "max-sm:flex-1")}
                >
                  <Sparkles size={14} aria-hidden="true" className="text-ink-600" />
                  Acceso total
                </button>
              )}
            </div>
            <label className="flex min-h-6 items-center gap-2 text-xs text-ink-800 max-md:min-h-11">
              <input
                type="checkbox"
                checked={removeOthers}
                onChange={(event) => setRemoveOthers(event.target.checked)}
                className="size-4 accent-gold-800"
              />
              Quitar lo que el plan no incluye
            </label>
            {confirmAll && (
              <div className="flex flex-wrap items-center gap-2 pb-2">
                <p className="text-xs font-medium text-ink-800">¿Das acceso total a este evento?</p>
                <button type="button" onClick={() => setConfirmAll(false)} className={ui.buttonSecondarySm}>
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={action.pending}
                  onClick={() => {
                    setConfirmAll(false);
                    action.run(() => grantEverything(eventId, action.reason));
                  }}
                  className={ui.buttonPrimarySm}
                >
                  Dar acceso total
                </button>
              </div>
            )}
          </div>
        ) : null}

        <div className="flex flex-col gap-1 pb-2">
          <label htmlFor={addonId} className="text-[13px] font-medium text-ink-800">
            Complemento
          </label>
          <div className="flex flex-wrap gap-2">
            <Select id={addonId} value={addonKey} onChange={(event) => setAddonKey(event.target.value)} className="w-full sm:w-48">
              {addons.map((addon) => (
                <option key={addon.key} value={addon.key}>
                  {addon.name}
                  {addon.isActive ? "" : " (inactivo)"}
                </option>
              ))}
            </Select>
            <button
              type="button"
              disabled={action.pending || !addonKey}
              onClick={() => action.run(() => applyAddon(eventId, addonKey, action.reason))}
              className={cn(ui.buttonSecondary, "max-sm:w-full")}
            >
              Sumar complemento
            </button>
          </div>
        </div>

        {!canAssignPlan && (
          <p className="flex items-center gap-2 pb-2 text-xs text-ink-600 sm:self-center">
            <Lock size={14} aria-hidden="true" className="shrink-0" />
            Tu rol no puede aplicar un plan completo ni dar acceso total.
          </p>
        )}
      </div>

      {/* Añadidos: lo que no viene del plan, cada uno con su origen, quién, cuándo y motivo. */}
      <Group
        title="Añadidos"
        count={added.length}
        hint="Una excepción fija el valor de un permiso. “Quitar” la revoca (junto con los complementos del panel) y regresa al valor del plan y de lo comprado."
      >
        {added.length === 0 ? (
          <p className="mx-4 mb-4 rounded-md border border-dashed border-ink-250 px-3 py-3 text-[13px] text-ink-600">
            Sin añadidos: todo lo que tiene viene {plan.name ? "del plan" : "de los permisos base"}.
          </p>
        ) : (
          <RowList origin>{added.map(row)}</RowList>
        )}
      </Group>

      <Group
        title={plan.name ? `Del plan ${plan.name}` : "Permisos base (sin plan)"}
        icon={<Lock size={14} aria-hidden="true" className="text-ink-600" />}
        count={inherited.length}
        hint={
          plan.name
            ? plan.note ?? "Heredados del plan. “Cambiar” un cupo o una opción crea una excepción."
            : "Permisos base de toda cuenta; no vienen de un plan comprado ni asignado."
        }
      >
        {inherited.length === 0 ? (
          <p className="mx-4 mb-4 rounded-md border border-dashed border-ink-250 px-3 py-3 text-[13px] text-ink-600">
            {plan.name ? "Este evento no tiene permisos del plan." : "Este evento no tiene permisos base."}
          </p>
        ) : (
          <details ref={inheritedRef} open className="group">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 border-t border-ink-150 px-4 py-3 text-sm font-semibold text-ink-950 hover:bg-surface-2/50 sm:hidden [&::-webkit-details-marker]:hidden">
              <ChevronRight
                size={14}
                aria-hidden="true"
                className="text-ink-600 transition-transform duration-[var(--dur-fast)] group-open:rotate-90"
              />
              Ver {inherited.length} permisos {plan.name ? "del plan" : "base"}
            </summary>
            <RowList>{inherited.map(row)}</RowList>
          </details>
        )}
      </Group>

      {inactive.length > 0 && (
        <details className="group border-t border-ink-150">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-ink-950 hover:bg-surface-2/50 [&::-webkit-details-marker]:hidden">
            <ChevronRight
              size={14}
              aria-hidden="true"
              className="text-ink-600 transition-transform duration-[var(--dur-fast)] group-open:rotate-90"
            />
            Sin activar
            <span className="font-normal text-ink-600 tabular-nums">{inactive.length}</span>
          </summary>
          <RowList>{inactive.map(row)}</RowList>
        </details>
      )}
    </section>
  );
}

function Group({
  title,
  icon,
  count,
  hint,
  children,
}: {
  title: string;
  icon?: ReactNode;
  count: number;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div className="border-t border-ink-150">
      <div className="px-4 pt-4 pb-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink-950">
          {icon}
          {title}
          <span className="font-normal text-ink-600 tabular-nums">{count}</span>
        </h3>
        <p className="mt-0.5 max-w-[75ch] text-xs text-ink-600">{hint}</p>
      </div>
      {children}
    </div>
  );
}

// Permiso · Valor · Origen · acción (cuando la sección mide 42rem o más). Origen solo existe en Añadidos;
// en los demás grupos Valor toma su ancho (8 + 8.5 + 0.75 de hueco) y Acción queda alineada entre grupos.
const COLUMNS = "@2xl:grid @2xl:items-center @2xl:gap-3";
const TRACKS_ORIGIN = "@2xl:grid-cols-[minmax(0,1fr)_8rem_8.5rem_15rem]";
const TRACKS = "@2xl:grid-cols-[minmax(0,1fr)_17.25rem_15rem]";

function RowList({ children, origin = false }: { children: ReactNode; origin?: boolean }) {
  return (
    <>
      <div
        aria-hidden="true"
        className={cn("hidden border-t border-ink-150 bg-surface-2 px-4 py-2 text-xs font-medium text-ink-600", COLUMNS, origin ? TRACKS_ORIGIN : TRACKS)}
      >
        <span>Permiso</span>
        <span>Valor</span>
        {origin && <span>Origen</span>}
        <span className="text-right">Acción</span>
      </div>
      <ul className="divide-y divide-ink-150 border-t border-ink-150">{children}</ul>
    </>
  );
}

type RowProps = {
  capability: EditorCapability;
  pending: boolean;
  onSet: (raw: string) => void;
  onClear: () => void;
};

function Value({ capability }: { capability: EditorCapability }) {
  return capability.current ? (
    <span className="inline-flex items-center gap-1 text-[13px] font-medium whitespace-nowrap text-ink-950 tabular-nums">
      <Check size={14} aria-hidden="true" className="text-ok-700" />
      {capability.current.label}
    </span>
  ) : (
    <span className="text-[13px] whitespace-nowrap text-ink-600">No lo tiene</span>
  );
}

// Solo lo añadido lleva chip: el encabezado del grupo ya dice de dónde viene lo heredado (R22).
function OriginBadge({ kind }: { kind: Exclude<OriginKind, "plan"> }) {
  const meta = ADDED[kind];
  const Icon = meta.icon;
  return (
    <Badge tone={meta.tone}>
      <Icon size={12} aria-hidden="true" />
      {meta.label}
    </Badge>
  );
}

/** Lo añadido: qué lo dio, quién, cuándo y por qué, en una línea bajo el nombre. */
function originDetail(origin: EditorOrigin | null): string | null {
  if (!origin || origin.kind === "plan") return null;
  return [
    origin.kind !== "acceso_total" && origin.item,
    origin.by === "compra" ? "Compra del cliente" : origin.by,
    origin.at && formatDate(origin.at, true),
    origin.reason && `Motivo: ${origin.reason}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Fila de altura fija. La clave interna (guest_limit…) no se muestra: va en el title junto a la descripción. */
function PermissionRow({ capability, ...props }: RowProps) {
  const detail = originDetail(capability.origin);
  // Mismo criterio que el grupo Añadidos: solo esas filas tienen columna Origen.
  const added = capability.origin && capability.origin.kind !== "plan" ? capability.origin.kind : null;
  return (
    <li className={cn("flex flex-col gap-2 px-4 py-2.5 @2xl:min-h-12 @2xl:py-2", COLUMNS, added ? TRACKS_ORIGIN : TRACKS)}>
      <div className="min-w-0">
        <p
          className="text-[13px] font-medium break-words text-ink-950 @2xl:truncate"
          title={[capability.description, capability.key].filter(Boolean).join(" · ")}
        >
          {capability.name}
        </p>
        {detail && (
          <p className="text-xs break-words text-ink-600 @2xl:truncate" title={detail}>
            {detail}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 @2xl:contents">
        <Value capability={capability} />
        {added && (
          <span>
            <OriginBadge kind={added} />
          </span>
        )}
      </div>
      <Controls capability={capability} collapsed={capability.current !== null} {...props} />
    </li>
  );
}

/**
 * Cambiar un valor: booleanos solo se activan; enteros y opciones llevan su
 * campo. collapsed: el campo aparece al pulsar "Cambiar" para no llenar la lista.
 */
function Controls({ capability, pending, onSet, onClear, collapsed = false }: RowProps & { collapsed?: boolean }) {
  const initial = capability.current?.raw ?? (capability.valueType === "enum" ? capability.enumValues[0] ?? "" : "");
  const [draft, setDraft] = useState(initial);
  const [open, setOpen] = useState(!collapsed);
  const active = capability.current !== null;
  const editable = capability.valueType !== "boolean";

  return (
    <div className="flex flex-wrap items-center gap-2 @2xl:justify-end">
      {capability.valueType === "boolean" && !active && (
        <button type="button" disabled={pending} onClick={() => onSet("true")} className={ui.buttonSecondarySm}>
          Activar
        </button>
      )}
      {editable && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Cambiar ${capability.name}`}
          className="h-8 rounded-md px-2 text-xs font-medium text-gold-800 hover:bg-surface-2 max-md:h-11"
        >
          Cambiar
        </button>
      )}
      {editable && open && (
        <>
          {capability.valueType === "integer" ? (
            <input
              type="number"
              min={0}
              max={1000000}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              aria-label={`${capability.name}: nuevo valor`}
              className={cn(ui.fieldSm, "w-24 tabular-nums")}
            />
          ) : (
            <Select
              size="sm"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              aria-label={`${capability.name}: nuevo valor`}
              className="max-w-44"
            >
              {capability.enumValues.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          )}
          <button
            type="button"
            disabled={pending || draft === "" || draft === capability.current?.raw}
            onClick={() => onSet(draft)}
            className={ui.buttonSecondarySm}
          >
            Guardar
          </button>
        </>
      )}
      {capability.hasOverride && (
        <button
          type="button"
          disabled={pending}
          onClick={onClear}
          aria-label={`Quitar ${capability.name}`}
          title="Quita la excepción y los complementos del panel; regresa al valor del plan y de lo comprado."
          className={cn(ui.buttonSecondarySm, "enabled:text-danger-700 enabled:hover:bg-danger-100")}
        >
          Quitar
        </button>
      )}
    </div>
  );
}
