"use server";

import { refresh } from "next/cache";
import { can, NO_PERMISSION, requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { getCatalog, type Capability, type CapabilityValue } from "@/lib/data/catalog";

export type ActionResult = { ok: boolean; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Todas las escrituras van por RPC con la sesión de quien las hace: la BD
 * comprueba el permiso y guarda quién y por qué en event_entitlement_grants.
 */
function friendlyError(error: { code?: string; message: string }): string {
  if (error.code === "42501") return NO_PERMISSION;
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
 * Editar permisos sueltos exige eventos.permisos (la RPC lo vuelve a validar).
 * wholePlan: aplicar un plan completo o dar acceso total regala funciones de
 * pago enteras; además exige eventos.asignar_plan.
 */
async function guard(
  eventId: string,
  reason: string,
  wholePlan = false
): Promise<{ error: string } | { reason: string }> {
  const admin = await requireAdmin();
  if (!can(admin, "eventos.permisos") || (wholePlan && !can(admin, "eventos.asignar_plan"))) return { error: NO_PERMISSION };
  if (!UUID.test(eventId)) return { error: "Evento no válido." };
  const cleanReason = validReason(reason);
  if (!cleanReason) return { error: "Escribe un motivo (mínimo 3 caracteres): queda en la auditoría." };
  return { reason: cleanReason };
}

/** Excepción: fija el valor de una capability; lo que el cliente compre después se suma encima. Los booleanos solo se activan. */
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

/** Quita la excepción y los complementos del panel de esa capability: regresa al valor del plan y de lo comprado. */
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

/**
 * Plan, complemento y acceso total van en UNA transacción
 * (admin_assign_to_event): se combinan igual que una compra (todo suma), sin
 * quedar a medias, y con registro en admin_event_assignments y admin_audit_log.
 */
async function assign(
  eventId: string,
  kind: "plan" | "complemento" | "acceso_total",
  itemKey: string | null,
  reason: string,
  label: string,
  removeOthers = false
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_assign_to_event", {
    p_event_id: eventId,
    p_kind: kind,
    p_item_key: itemKey,
    p_courtesy: false,
    p_reason: reason,
    p_remove_others: removeOthers,
  });
  if (error) return { ok: false, message: friendlyError(error) };
  refresh();
  const changed = Number(data ?? 0);
  return { ok: true, message: changed === 0 ? `${label}: ya estaba así, sin cambios.` : `${label}: ${changed} cambios aplicados.` };
}

/**
 * Da el plan como una compra: gana el más alto contra lo comprado y reemplaza el
 * plan que el panel dio antes. Salir de Tour quita choose_plan. Con removeOthers,
 * revoca lo que dio el panel fuera del plan.
 */
export async function applyPlan(
  eventId: string,
  planKey: string,
  removeOthers: boolean,
  reason: string
): Promise<ActionResult> {
  const checked = await guard(eventId, reason, true);
  if ("error" in checked) return { ok: false, message: checked.error };
  const plan = (await getCatalog()).plans.find((item) => item.key === planKey);
  if (!plan) return { ok: false, message: "Plan desconocido." };
  return assign(eventId, "plan", plan.key, checked.reason, `Plan ${plan.name}`, removeOthers);
}

/** Suma un complemento igual que una compra (+50 invitados suma 50). */
export async function applyAddon(eventId: string, addonKey: string, reason: string): Promise<ActionResult> {
  const checked = await guard(eventId, reason, true);
  if ("error" in checked) return { ok: false, message: checked.error };
  const addon = (await getCatalog()).addons.find((item) => item.key === addonKey);
  if (!addon) return { ok: false, message: "Complemento desconocido." };
  return assign(eventId, "complemento", addon.key, checked.reason, addon.name);
}

/** Todo: el plan Atelier + los complementos activos que Atelier no trae. */
export async function grantEverything(eventId: string, reason: string): Promise<ActionResult> {
  const checked = await guard(eventId, reason, true);
  if ("error" in checked) return { ok: false, message: checked.error };
  return assign(eventId, "acceso_total", null, checked.reason, "Acceso total");
}
