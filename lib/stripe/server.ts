import "server-only";
import Stripe from "stripe";

export class StripeNotConfiguredError extends Error {
  constructor() {
    super("Falta STRIPE_SECRET_KEY en el servidor del panel (una restricted key con Coupons, Promotion codes y Products).");
  }
}

let client: Stripe | null = null;

/**
 * Stripe del panel. SOLO servidor: la llave nunca llega al navegador. Se
 * recomienda una restricted key (rk_…) con escritura en Coupons, Promotion
 * codes y Products, nada más.
 */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new StripeNotConfiguredError();
  client ??= new Stripe(key, { appInfo: { name: "Celebraloo Panel Admin" } });
  return client;
}

export function stripeMode(): "test" | "live" | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return /_live_/.test(key) ? "live" : "test";
}
