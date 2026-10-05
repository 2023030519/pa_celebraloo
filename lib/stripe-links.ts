import "server-only";

/**
 * Enlaces al dashboard de Stripe. El panel no tiene llave de Stripe: solo
 * arma URLs. STRIPE_DASHBOARD_MODE=live cuando Celebraloo cobre en
 * producción; por defecto, test.
 */
function base(): string {
  return process.env.STRIPE_DASHBOARD_MODE?.trim() === "live"
    ? "https://dashboard.stripe.com"
    : "https://dashboard.stripe.com/test";
}

export function stripePaymentUrl(paymentIntentId: string | null): string | null {
  return paymentIntentId ? `${base()}/payments/${encodeURIComponent(paymentIntentId)}` : null;
}

export function stripeDisputeUrl(disputeId: string): string {
  return `${base()}/disputes/${encodeURIComponent(disputeId)}`;
}

/** "sk_test_…abcd" → "…abcd". Para mostrar identificadores sin exponerlos completos. */
export function maskId(value: string | null | undefined, visible = 6): string {
  if (!value) return "—";
  return value.length <= visible ? value : `…${value.slice(-visible)}`;
}
