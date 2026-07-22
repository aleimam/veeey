import { describe, expect, it } from 'vitest';
import en from '../../messages/en.json';
import ar from '../../messages/ar.json';
import { checkCoupon } from './coupon';

/**
 * Every way a coupon can be refused must have its own sentence, in both
 * languages.
 *
 * The point of the Apply button is that "expired" and "spend EGP 300 to use it"
 * are different problems with different fixes. A missing key silently collapses
 * one of them back into a generic "can't be used" — which is the exact failure
 * this feature exists to remove, and nothing else would catch it.
 */
const FAILURES = [
  'empty', 'empty_cart', 'not_found', 'inactive', 'not_started', 'expired',
  'first_order_only', 'min_spend', 'per_customer', 'usage_limit', 'invalid',
] as const;

const msgs = { en, ar } as Record<string, { storefront: { checkout: Record<string, string> } }>;

describe('coupon refusal messages', () => {
  for (const locale of ['en', 'ar']) {
    it(`covers every failure reason in ${locale}`, () => {
      const checkout = msgs[locale].storefront.checkout;
      for (const reason of FAILURES) {
        expect(checkout[`coupon_${reason}`], `${locale}: coupon_${reason}`).toBeTruthy();
      }
      expect(checkout.couponApply).toBeTruthy();
      expect(checkout.couponApplied).toBeTruthy();
      expect(checkout.couponMinSpend).toBeTruthy();
    });
  }

  it('names every reason the pure engine can actually produce', () => {
    // Guards the other direction: a reason added to checkCoupon() with no
    // matching string would show the generic fallback forever.
    const base = { type: 'PERCENT' as const, value: 10, firstOrderOnly: false, active: true };
    const now = new Date('2026-07-23T00:00:00Z');
    const ctx = { subtotalPiastres: 10_000n, isFirstOrder: true, now };
    const reasons = [
      checkCoupon({ ...base, active: false }, ctx).reason,
      checkCoupon({ ...base, startsAt: new Date('2026-08-01') }, ctx).reason,
      checkCoupon({ ...base, endsAt: new Date('2026-07-01') }, ctx).reason,
      checkCoupon({ ...base, firstOrderOnly: true }, { ...ctx, isFirstOrder: false }).reason,
      checkCoupon({ ...base, minSpendPiastres: 50_000n }, ctx).reason,
    ];
    expect(reasons).toEqual(['inactive', 'not_started', 'expired', 'first_order_only', 'min_spend']);
    for (const r of reasons) expect(FAILURES).toContain(r);
  });
});
