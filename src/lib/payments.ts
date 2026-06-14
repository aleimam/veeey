/**
 * Payment adapters (FR-PAY-*). One interface, many providers — admin orders the
 * list (cheaper first). Offline methods (COD/POS/bank/wallet) settle on delivery
 * or manual confirmation; online providers (OPay/Kashier) are env-gated and would
 * return a hosted-checkout redirect when keys are present. Gateway webhooks
 * (api/payments/webhook) flip the order's payment state.
 */
export type PaymentMethodKey = 'COD' | 'POS_ON_DELIVERY' | 'BANK_TRANSFER' | 'WALLET' | 'OPAY' | 'KASHIER';

export type PaymentMethodMeta = { key: PaymentMethodKey; label: string; online: boolean; order: number };

export const PAYMENT_METHODS: PaymentMethodMeta[] = [
  { key: 'COD', label: 'Cash on delivery', online: false, order: 1 },
  { key: 'POS_ON_DELIVERY', label: 'Card machine on delivery', online: false, order: 2 },
  { key: 'KASHIER', label: 'Pay online (Kashier)', online: true, order: 3 },
  { key: 'OPAY', label: 'Pay online (OPay)', online: true, order: 4 },
  { key: 'BANK_TRANSFER', label: 'Bank transfer', online: false, order: 5 },
  { key: 'WALLET', label: 'Mobile wallet', online: false, order: 6 },
];

export type PaymentInit = { state: 'PENDING'; redirectUrl?: string };

/** Methods offered at checkout — online providers only when configured. */
export function enabledPaymentMethods(): PaymentMethodMeta[] {
  return PAYMENT_METHODS.filter((m) => {
    if (!m.online) return true;
    if (m.key === 'KASHIER') return !!process.env.KASHIER_API_KEY;
    if (m.key === 'OPAY') return !!process.env.OPAY_SECRET_KEY;
    return false;
  }).sort((a, b) => a.order - b.order);
}

/** Create a payment intent. Offline → PENDING (settle later). Online → would
 *  return a provider redirect; stubbed to a local confirm route until keys/SDK. */
export async function createPaymentIntent(
  method: PaymentMethodKey,
  order: { number: string; chargePiastres: bigint; locale: string },
): Promise<PaymentInit> {
  const meta = PAYMENT_METHODS.find((m) => m.key === method);
  if (meta?.online) {
    return { state: 'PENDING', redirectUrl: `/${order.locale}/checkout/confirmation?order=${order.number}` };
  }
  return { state: 'PENDING' };
}
