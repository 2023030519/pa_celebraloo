import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { stripeMode } from "@/lib/stripe/server";
import { syncPromotionsFromStripe } from "@/lib/stripe/sync-promotions";

export const runtime = "nodejs";

/**
 * Tarea programada: activa en Stripe los códigos cuya fecha de inicio ya
 * llegó y trae sus usos. Sin sesión de usuario: exige CRON_SECRET (Vercel
 * Cron lo manda como Bearer). Solo sincroniza; no crea ni edita promociones.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!stripeMode()) return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });

  const result = await syncPromotionsFromStripe(createServiceRoleClient());
  if (result.errors.length) console.error("[cron-promociones]", result.errors);
  return NextResponse.json({ synced: result.synced, errors: result.errors.length });
}
