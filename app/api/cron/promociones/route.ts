import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { stripeMode } from "@/lib/stripe/server";
import { deactivateOrphanPromotionCodes, syncPromotionsFromStripe } from "@/lib/stripe/sync-promotions";

export const runtime = "nodejs";

/**
 * Tarea programada: activa en Stripe los códigos cuya fecha de inicio ya
 * llegó y trae sus usos. Sin sesión de usuario: exige CRON_SECRET (Vercel
 * Cron lo manda como Bearer). Solo sincroniza y apaga códigos huérfanos
 * (creados en Stripe sin fila en la BD); no crea ni edita promociones.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!stripeMode()) return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });

  const supabase = createServiceRoleClient();
  const result = await syncPromotionsFromStripe(supabase);
  const orphans = await deactivateOrphanPromotionCodes(supabase);
  const errors = [...result.errors, ...orphans.errors];
  if (orphans.deactivated.length) console.warn("[cron-promociones] códigos sin fila desactivados:", orphans.deactivated);
  if (errors.length) console.error("[cron-promociones]", errors);
  return NextResponse.json({ synced: result.synced, orphansDeactivated: orphans.deactivated.length, errors: errors.length });
}
