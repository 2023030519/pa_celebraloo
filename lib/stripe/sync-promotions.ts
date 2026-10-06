import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readStripePromotionCode, setStripePromotionCodeActive, stripeErrorMessage } from "@/lib/stripe/promotions";

type Row = {
  id: string;
  code: string;
  is_active: boolean;
  starts_at: string;
  expires_at: string | null;
  stripe_promotion_code_id: string;
  times_redeemed_synced_at: string | null;
};

/**
 * Trae de Stripe los usos de cada código y activa los programados cuando
 * llega su fecha de inicio (Stripe no tiene "inicio"). Stripe ya deja de
 * aceptar un código vencido o agotado por su cuenta.
 * minAgeMs: no vuelve a consultar códigos sincronizados hace menos de eso.
 */
export async function syncPromotionsFromStripe(supabase: SupabaseClient, minAgeMs = 0): Promise<{ synced: number; errors: string[] }> {
  const { data, error } = await supabase
    .from("admin_promotions")
    .select("id, code, is_active, starts_at, expires_at, stripe_promotion_code_id, times_redeemed_synced_at")
    .not("stripe_promotion_code_id", "is", null);
  if (error) return { synced: 0, errors: [error.message] };

  const now = Date.now();
  const errors: string[] = [];
  let synced = 0;
  for (const row of (data ?? []) as Row[]) {
    if (minAgeMs && row.times_redeemed_synced_at && now - new Date(row.times_redeemed_synced_at).getTime() < minAgeMs) continue;
    try {
      const code = await readStripePromotionCode(row.stripe_promotion_code_id);
      const shouldBeActive =
        row.is_active && new Date(row.starts_at).getTime() <= now && (!row.expires_at || new Date(row.expires_at).getTime() > now);
      let active = code.active;
      // Solo se enciende un programado que ya empezó, o se apaga uno que el panel desactivó.
      if (shouldBeActive && !code.active && code.max_redemptions !== code.times_redeemed) {
        await setStripePromotionCodeActive(code.id, true);
        active = true;
      } else if (!row.is_active && code.active) {
        await setStripePromotionCodeActive(code.id, false);
        active = false;
      }
      const { error: rpcError } = await supabase.rpc("admin_sync_promotion", {
        p_id: row.id,
        p_current_redeemed: code.times_redeemed,
        p_stripe_active: active,
      });
      if (rpcError) errors.push(`${row.code}: ${rpcError.message}`);
      else synced++;
    } catch (syncError) {
      errors.push(`${row.code}: ${stripeErrorMessage(syncError)}`);
    }
  }
  return { synced, errors };
}
