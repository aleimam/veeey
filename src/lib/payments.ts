/**
 * Payment façade. Payment methods are now an admin-editable DB list — see
 * payment-method-service.ts (source of truth). This file keeps the checkout
 * payment-intent entry point and re-exports the common helpers so existing
 * imports keep working.
 */
import { isOnlineMethod } from '@/lib/payment-method-service';

export { enabledPaymentMethods, paymentMethodLabel, isOnlineMethod } from '@/lib/payment-method-service';

export type PaymentInit = { state: 'PENDING'; redirectUrl?: string };

/** Create a payment intent. Offline → PENDING (settle later). Online (card via
 *  Kashier) → returns a provider redirect; stubbed to the confirm route until the
 *  gateway SDK is wired. */
export async function createPaymentIntent(
  method: string,
  order: { number: string; chargePiastres: bigint; locale: string },
): Promise<PaymentInit> {
  if (await isOnlineMethod(method)) {
    return { state: 'PENDING', redirectUrl: `/${order.locale}/checkout/confirmation?order=${order.number}` };
  }
  return { state: 'PENDING' };
}
