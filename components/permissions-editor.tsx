"use client";

import { useState, useTransition } from "react";
import { Check, Minus, Sparkles } from "lucide-react";
import {
  applyAddon,
  applyPlan,
  clearCapability,
  grantEverything,
  setCapability,
  type ActionResult,
} from "@/app/(admin)/eventos/[id]/actions";
import { cn } from "@/components/ui";

export type EditorCapability = {
  key: string;
  name: string;
  valueType: "boolean" | "integer" | "enum";
  enumValues: string[];
  description: string | null;
  /** Valor efectivo hoy; null = el evento no lo tiene. */
  current: { label: string; raw: string; source: string } | null;
  hasOverride: boolean;
};

export type EditorOption = { key: string; name: string; isActive: boolean; summary: string };

const SOURCE_LABEL: Record<string, string> = {
  plan: "Plan comprado",
  addon: "Complemento comprado",
  admin_override: "Admin",
};

const inputClass =
  "h-9 rounded-md border border-ink-250 bg-surface px-2.5 outline-none focus:border-gold-600 focus:ring-2 focus:ring-gold-600/30 disabled:opacity-50";
const buttonClass =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-3 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40";

export function PermissionsEditor({
  eventId,
  capabilities,
  plans,
  addons,
  isSuperAdmin,
}: {
  eventId: string;
  /** Aplicar plan y Acceso total solo para superadmin (la acción también lo valida). */
  isSuperAdmin: boolean;
  capabilities: EditorCapability[];
  plans: EditorOption[];
  addons: EditorOption[];
}) {
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [planKey, setPlanKey] = useState(plans.find((plan) => plan.key === "atelier")?.key ?? plans[0]?.key ?? "");
  const [removeOthers, setRemoveOthers] = useState(false);
  const [addonKey, setAddonKey] = useState(addons.find((addon) => addon.isActive)?.key ?? "");
  const [confirmAll, setConfirmAll] = useState(false);
  const reasonReady = reason.trim().length >= 3;

  const run = (action: () => Promise<ActionResult>) => {
    setResult(null);
    startTransition(async () => {
      setResult(await action());
    });
  };

  const disabled = pending || !reasonReady;

  return (
    <div className="flex flex-col gap-5">
      <div className="sticky top-0 z-10 -mx-4 border-b border-ink-150 bg-paper/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-800">
            Motivo del cambio <span className="font-normal text-ink-600">(obligatorio, queda en la auditoría)</span>
          </span>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            placeholder="Ej.: cortesía para pruebas del equipo"
            className={cn(inputClass, "w-full max-w-xl")}
          />
        </label>
        <p aria-live="polite" className="mt-2 min-h-5 text-[13px]">
          {pending && <span className="text-ink-600">Aplicando…</span>}
          {!pending && result && (
            <span className={result.ok ? "text-ok-700" : "text-danger-700"}>{result.message}</span>
          )}
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {isSuperAdmin && (
        <section className="flex flex-col gap-2 rounded-xl border border-ink-150 bg-surface p-4 shadow-sm">
          <h3 className="text-[13px] font-semibold">Aplicar plan</h3>
          <p className="text-xs text-ink-600">Deja los valores exactos del plan (también baja límites). Salir de Tour quita “Elegir plan”.</p>
          <select value={planKey} onChange={(event) => setPlanKey(event.target.value)} className={inputClass} aria-label="Plan">
            {plans.map((plan) => (
              <option key={plan.key} value={plan.key}>
                {plan.name}
                {plan.isActive ? "" : " (inactivo)"} · {plan.summary}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs text-ink-800">
            <input type="checkbox" checked={removeOthers} onChange={(event) => setRemoveOthers(event.target.checked)} />
            Quitar lo que el plan no incluye
          </label>
          <button
            disabled={disabled || !planKey}
            onClick={() => run(() => applyPlan(eventId, planKey, removeOthers, reason))}
            className={cn(buttonClass, "mt-auto bg-ink-950 text-surface hover:bg-ink-800")}
          >
            Aplicar plan
          </button>
        </section>
        )}

        <section className="flex flex-col gap-2 rounded-xl border border-ink-150 bg-surface p-4 shadow-sm">
          <h3 className="text-[13px] font-semibold">Sumar complemento</h3>
          <p className="text-xs text-ink-600">Solo sube valores: nunca baja un límite que el evento ya tenga.</p>
          <select value={addonKey} onChange={(event) => setAddonKey(event.target.value)} className={inputClass} aria-label="Complemento">
            {addons.map((addon) => (
              <option key={addon.key} value={addon.key}>
                {addon.name}
                {addon.isActive ? "" : " (inactivo)"}
              </option>
            ))}
          </select>
          <button
            disabled={disabled || !addonKey}
            onClick={() => run(() => applyAddon(eventId, addonKey, reason))}
            className={cn(buttonClass, "mt-auto bg-ink-950 text-surface hover:bg-ink-800")}
          >
            Sumar complemento
          </button>
        </section>

        {isSuperAdmin ? (
        <section className="flex flex-col gap-2 rounded-xl border border-gold-600/60 bg-gold-100/40 p-4 shadow-sm">
          <h3 className="flex items-center gap-1.5 text-[13px] font-semibold">
            <Sparkles size={14} aria-hidden="true" /> Acceso total
          </h3>
          <p className="text-xs text-ink-600">Atelier + todos los complementos activos, con el mayor valor de cada uno. Sale de Tour.</p>
          {confirmAll ? (
            <div className="mt-auto flex gap-2">
              <button
                disabled={disabled}
                onClick={() => {
                  setConfirmAll(false);
                  run(() => grantEverything(eventId, reason));
                }}
                className={cn(buttonClass, "flex-1 bg-gold-600 text-ink-950 hover:bg-gold-600/85")}
              >
                Confirmar
              </button>
              <button onClick={() => setConfirmAll(false)} className={cn(buttonClass, "border border-ink-250 hover:bg-paper")}>
                Cancelar
              </button>
            </div>
          ) : (
            <button
              disabled={disabled}
              onClick={() => setConfirmAll(true)}
              className={cn(buttonClass, "mt-auto bg-gold-600 text-ink-950 hover:bg-gold-600/85")}
            >
              Dar acceso total
            </button>
          )}
        </section>
        ) : (
          <p className="self-center text-xs text-ink-600 lg:col-span-2">
            Aplicar un plan completo y dar acceso total son solo para superadmin.
          </p>
        )}
      </div>

      {!reasonReady && (
        <p className="-mt-2 text-xs text-ink-600">Escribe el motivo arriba para habilitar los cambios.</p>
      )}

      <div className="overflow-x-auto rounded-xl border border-ink-150 bg-surface shadow-sm">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead className="bg-surface-2 text-[11px] uppercase tracking-[0.08em] text-ink-600">
            <tr>
              <th className="px-3 py-2.5 font-semibold">Permiso</th>
              <th className="px-3 py-2.5 font-semibold">Valor actual</th>
              <th className="px-3 py-2.5 font-semibold">Origen</th>
              <th className="px-3 py-2.5 font-semibold">Cambiar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-150">
            {capabilities.map((capability) => (
              <CapabilityRow
                key={`${capability.key}:${capability.current?.raw ?? ""}`}
                capability={capability}
                disabled={disabled}
                onSet={(raw) => run(() => setCapability(eventId, capability.key, raw, reason))}
                onClear={() => run(() => clearCapability(eventId, capability.key, reason))}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CapabilityRow({
  capability,
  disabled,
  onSet,
  onClear,
}: {
  capability: EditorCapability;
  disabled: boolean;
  onSet: (raw: string) => void;
  onClear: () => void;
}) {
  const initial =
    capability.current?.raw ?? (capability.valueType === "enum" ? capability.enumValues[0] ?? "" : "");
  const [draft, setDraft] = useState(initial);
  const active = capability.current !== null;

  return (
    <tr className={cn(!active && "text-ink-600")}>
      <td className="px-3 py-2.5 align-top">
        <p className="font-medium text-ink-950">{capability.name}</p>
        <p className="font-mono text-[11px] text-ink-600">{capability.key}</p>
      </td>
      <td className="px-3 py-2.5 align-top">
        {active ? (
          <span className="inline-flex items-center gap-1 font-medium text-ok-700">
            <Check size={14} aria-hidden="true" />
            {capability.current!.label}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <Minus size={14} aria-hidden="true" />
            No lo tiene
          </span>
        )}
      </td>
      <td className="px-3 py-2.5 align-top text-xs">
        {capability.current ? SOURCE_LABEL[capability.current.source] ?? capability.current.source : "—"}
      </td>
      <td className="px-3 py-2.5 align-top">
        <div className="flex flex-wrap items-center gap-2">
          {capability.valueType === "boolean" && !active && (
            <button
              disabled={disabled}
              onClick={() => onSet("true")}
              className={cn(buttonClass, "h-8 bg-ink-950 text-surface hover:bg-ink-800")}
            >
              Activar
            </button>
          )}
          {capability.valueType === "integer" && (
            <>
              <input
                type="number"
                min={0}
                max={1000000}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                aria-label={`${capability.name}: nuevo valor`}
                className={cn(inputClass, "h-8 w-28")}
              />
              <button
                disabled={disabled || draft === "" || draft === capability.current?.raw}
                onClick={() => onSet(draft)}
                className={cn(buttonClass, "h-8 bg-ink-950 text-surface hover:bg-ink-800")}
              >
                Guardar
              </button>
            </>
          )}
          {capability.valueType === "enum" && (
            <>
              <select
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                aria-label={`${capability.name}: nuevo valor`}
                className={cn(inputClass, "h-8")}
              >
                {capability.enumValues.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <button
                disabled={disabled || draft === capability.current?.raw}
                onClick={() => onSet(draft)}
                className={cn(buttonClass, "h-8 bg-ink-950 text-surface hover:bg-ink-800")}
              >
                Guardar
              </button>
            </>
          )}
          {active && (
            <button
              disabled={disabled}
              onClick={onClear}
              title={
                capability.current!.source === "admin_override" || !capability.hasOverride
                  ? "Quita el permiso. Si una compra lo otorga, vuelve al valor comprado."
                  : "Quita el override del admin y deja el valor comprado."
              }
              className={cn(buttonClass, "h-8 border border-danger-700/40 text-danger-700 hover:bg-danger-100")}
            >
              Quitar
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
