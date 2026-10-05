import type { Capability, CapabilityValue } from "@/lib/data/catalog";

/**
 * Orden de un enum = orden de capabilities.enum_values, que coincide con
 * private.enum_value_rank (whatsapp < platform, coleccion_selecta <
 * custom_identity). Mayor = más acceso.
 */
export function valueRank(capability: Capability, value: CapabilityValue): number {
  if (capability.valueType === "boolean") return value.value_boolean ? 1 : 0;
  if (capability.valueType === "integer") return value.value_integer ?? -1;
  return capability.enumValues.indexOf(value.value_text ?? "");
}

/** Combina varios otorgamientos quedándose con el de más acceso por capability. */
export function mergeHighest(
  capabilities: Capability[],
  sources: (CapabilityValue & { capability_key: string })[]
): Map<string, CapabilityValue> {
  const byKey = new Map(capabilities.map((cap) => [cap.key, cap]));
  const merged = new Map<string, CapabilityValue>();
  for (const item of sources) {
    const capability = byKey.get(item.capability_key);
    if (!capability) continue;
    const current = merged.get(item.capability_key);
    if (!current || valueRank(capability, item) > valueRank(capability, current)) {
      merged.set(item.capability_key, {
        value_boolean: item.value_boolean,
        value_integer: item.value_integer,
        value_text: item.value_text,
      });
    }
  }
  return merged;
}

export function sameValue(a: CapabilityValue, b: CapabilityValue): boolean {
  return a.value_boolean === b.value_boolean && a.value_integer === b.value_integer && a.value_text === b.value_text;
}
