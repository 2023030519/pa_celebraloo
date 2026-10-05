"use server";

import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getCatalog, type Capability, type CapabilityValue } from "@/lib/data/catalog";
import { mergeHighest, sameValue, valueRank } from "@/lib/entitlements/values";

export type ActionResult = { ok: boolean; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Todas las escrituras van por RPC con la sesión del admin: la BD comprueba
 * is_platform_admin y guarda quién y por qué en event_entitlement_grants.
 * El service role solo se usa para leer el estado actual.
 */
function friendlyError(error: { code?: string; message: string }): string {
  if (error.code === "42501") return "Tu usuario no es admin de plataforma en la base de datos.";
  if (error.code === "PGRST202" || /could not find the function/i.test(error.message)) {
    return "Falta aplicar la migración 20260928120000_clear_event_capability_override.sql en Supabase.";
  }
  if (error.code === "23514") return `Valor no válido: ${error.message}`;
  return error.message;
}

function validReason(reason: string): string | null {
  const trimmed = reason.trim();
  return trimmed.length >= 3 ? trimmed.slice(0, 500) : null;
}

async function readCurrent(eventId: string): Promise<Map<string, CapabilityValue>> {
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("event_entitlements")
    .select("capability_key, value_boolean, value_integer, value_text")
    .eq("event_id", eventId);
  if (error) throw new Error(error.message);
  return new Map(
    (data ?? []).map((row) => [
      row.capability_key,
      { value_boolean: row.value_boolean, value_integer: row.value_integer, value_text: row.value_text },
    ])
  );
}

async function setOne(eventId: string, key: string, value: CapabilityValue, reason: string) {
  const supabase = await createClient();
  return supabase.rpc("set_event_capability_override", {
    p_event_id: eventId,
    p_capability_key: key,
    p_value_boolean: value.value_boolean,
    p_value_integer: value.value_integer,
    p_value_text: value.value_text,
    p_reason: reason,
  });
}

async function clearOne(eventId: string, key: string, reason: string) {
  const supabase = await createClient();
  return supabase.rpc("clear_event_capability_override", {
    p_event_id: eventId,
    p_capability_key: key,
    p_reason: reason,
  });
}

function parseValue(capability: Capability, raw: string): CapabilityValue | null {
  const empty = { value_boolean: null, value_integer: null, value_text: null };
  if (capability.valueType === "boolean") return { ...empty, value_boolean: true };
  if (capability.valueType === "integer") {
    const number = Number(raw);
    if (!Number.isInteger(number) || number < 0 || number > 1_000_000) return null;
    return { ...empty, value_integer: number };
  }
  return capability.enumValues.includes(raw) ? { ...empty, value_text: raw } : null;
}

/**
 * superOnly: aplicar un plan completo o dar acceso total regala funciones de
 * pago enteras; eso queda para superadmin. Las RPCs de permisos son por
 * capability y no distinguen el rol, así que esta regla vive solo aquí.
 */
async function guard(
  eventId: string,
  reason: string,
  superOnly = false
): Promise<{ error: string } | { reason: string }> {
  const admin = await requireAdmin();
  if (superOnly && !admin.isSuperAdmin) return { error: "Solo un superadmin puede hacer esto." };
  if (!UUID.test(eventId)) return { error: "Evento no válido." };
  const cleanReason = validReason(reason);
  if (!cleanReason) return { error: "Escribe un motivo (mínimo 3 caracteres): queda en la auditoría." };
  return { reason: cleanReason };
}

/** Activa o fija el valor de una capability. Los booleanos solo se activan: para apagar, clearCapability. */
export async function setCapability(
  eventId: string,
  capabilityKey: string,
  rawValue: string,
  reason: string
): Promise<ActionResult> {
  const checked = await guard(eventId, reason);
  if ("error" in checked) return { ok: false, message: checked.error };

  const capability = (await getCatalog()).capabilities.find((cap) => cap.key === capabilityKey);
  if (!capability) return { ok: false, message: "Permiso desconocido." };
  const value = parseValue(capability, rawValue);
  if (!value) return { ok: false, message: "Valor no válido para este permiso." };

  const { error } = await setOne(eventId, capabilityKey, value, checked.reason);
  if (error) return { ok: false, message: friendlyError(error) };
  refresh();
  return { ok: true, message: `${capability.name}: actualizado.` };
}

/** Quita el override. Si una compra lo otorga, vuelve a ese valor; si no, se apaga. */
export async function clearCapability(eventId: string, capabilityKey: string, reason: string): Promise<ActionResult> {
  const checked = await guard(eventId, reason);
  if ("error" in checked) return { ok: false, message: checked.error };

  const capability = (await getCatalog()).capabilities.find((cap) => cap.key === capabilityKey);
  if (!capability) return { ok: false, message: "Permiso desconocido." };

  const { error } = await clearOne(eventId, capabilityKey, checked.reason);
  if (error) return { ok: false, message: friendlyError(error) };
  refresh();
  return { ok: true, message: `${capability.name}: quitado.` };
}

type BulkPlan = { set: Map<string, CapabilityValue>; clear: string[] };

async function runBulk(eventId: string, plan: BulkPlan, reason: string, label: string): Promise<ActionResult> {
  let changed = 0;
  for (const [key, value] of plan.set) {
    const { error } = await setOne(eventId, key, value, reason);
    if (error) {
      refresh();
      return { ok: false, message: `${label}: se detuvo en "${key}" (${changed} cambios aplicados). ${friendlyError(error)}` };
    }
    changed++;
  }
  for (const key of plan.clear) {
    const { error } = await clearOne(eventId, key, reason);
    if (error) {
      refresh();
      return { ok: false, message: `${label}: se detuvo al quitar "${key}" (${changed} cambios aplicados). ${friendlyError(error)}` };
    }
    changed++;
  }
  refresh();
  return { ok: true, message: changed === 0 ? `${label}: ya estaba así, sin cambios.` : `${label}: ${changed} cambios aplicados.` };
}

/**
 * Deja el evento con los valores EXACTOS del plan (también baja límites).
 * Salir de Tour quita choose_plan. Con removeOthers, apaga lo que el plan no incluye.
 */
export async function applyPlan(
  eventId: string,
  planKey: string,
  removeOthers: boolean,
  reason: string
): Promise<ActionResult> {
  const checked = await guard(eventId, reason, true);
  if ("error" in checked) return { ok: false, message: checked.error };

  const catalog = await getCatalog();
  const plan = catalog.plans.find((item) => item.key === planKey);
  if (!plan) return { ok: false, message: "Plan desconocido." };

  const current = await readCurrent(eventId);
  const target = mergeHighest(catalog.capabilities, plan.capabilities);
  const set = new Map([...target].filter(([key, value]) => !current.has(key) || !sameValue(current.get(key)!, value)));
  const clear = [...current.keys()].filter(
    (key) => !target.has(key) && (removeOthers || (key === "choose_plan" && planKey !== "tour"))
  );

  return runBulk(eventId, { set, clear }, `${checked.reason} [plan ${plan.name}]`, `Plan ${plan.name}`);
}

/** Suma un complemento: solo sube valores, nunca baja un límite que ya tenía. */
export async function applyAddon(eventId: string, addonKey: string, reason: string): Promise<ActionResult> {
  const checked = await guard(eventId, reason);
  if ("error" in checked) return { ok: false, message: checked.error };

  const catalog = await getCatalog();
  const addon = catalog.addons.find((item) => item.key === addonKey);
  if (!addon) return { ok: false, message: "Complemento desconocido." };

  return raiseTo(eventId, catalog.capabilities, addon.capabilities, `${checked.reason} [complemento ${addon.name}]`, addon.name);
}

/** Todo: el plan más alto (Atelier) + todos los complementos activos, con el mayor valor de cada uno. */
export async function grantEverything(eventId: string, reason: string): Promise<ActionResult> {
  const checked = await guard(eventId, reason, true);
  if ("error" in checked) return { ok: false, message: checked.error };

  const catalog = await getCatalog();
  const sources = [
    ...(catalog.plans.find((plan) => plan.key === "atelier")?.capabilities ?? []),
    ...catalog.addons.filter((addon) => addon.isActive).flatMap((addon) => addon.capabilities),
  ];
  return raiseTo(eventId, catalog.capabilities, sources, `${checked.reason} [acceso total]`, "Acceso total", true);
}

async function raiseTo(
  eventId: string,
  capabilities: Capability[],
  sources: (CapabilityValue & { capability_key: string })[],
  reason: string,
  label: string,
  leaveTour = false
): Promise<ActionResult> {
  const byKey = new Map(capabilities.map((cap) => [cap.key, cap]));
  const current = await readCurrent(eventId);
  const target = mergeHighest(capabilities, sources);
  const set = new Map(
    [...target].filter(([key, value]) => {
      const now = current.get(key);
      return !now || valueRank(byKey.get(key)!, value) > valueRank(byKey.get(key)!, now);
    })
  );
  const clear = leaveTour && current.has("choose_plan") ? ["choose_plan"] : [];
  return runBulk(eventId, { set, clear }, reason, label);
}
