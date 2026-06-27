/**
 * Payment façade. Methods are a two-level model in payment-method-service.ts
 * (fixed customer-facing list + editable granular system list). This keeps the
 * checkout payment-intent entry point and re-exports the common helpers.
 */
import { isOnlineMethod, gatewayFor } from '@/lib/payment-method-service';

export { enabledCustomerMethods, customerLabel, isOnlineMethod } from '@/lib/payment-method-service';

export type PaymentInit = { state: 'PENDING'; redirectUrl?: string };

/** Create a payment intent. Offline → PENDING (settle later). Online card (OPay /
 *  Kashier) → would return the gateway redirect; stubbed to the confirm route. */
export async function createPaymentIntent(
  method: string,
  order: { number: string; chargePiastres: bigint; locale: string },
): Promise<PaymentInit> {
  if (isOnlineMethod(method)) {
    void gatewayFor(method); // OPAY | KASHIER — selects the gateway when the SDK is wired
    return { state: 'PENDING', redirectUrl: `/${order.locale}/checkout/confirmation?order=${order.number}` };
  }
  return { state: 'PENDING' };
}
