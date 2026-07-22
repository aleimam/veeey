'use server';

import { prisma } from '@/lib/prisma';
import { readCartSnapshot } from '@/lib/cart-service';
import { applyCoupon } from '@/lib/coupon-service';
import { getCurrentUser } from '@/lib/auth-guards';

/**
 * Check a coupon BEFORE the order is placed (owner 2026-07-23).
 *
 * Until now the code was only looked at during placement — and there,
 * `placeOrder` quietly dropped an invalid one and charged full price. A shopper
 * who mistyped a code, or whose promo had expired, got no discount and no
 * explanation, and only the total to notice it by. This gives them an answer at
 * the moment they type it, and a specific one: "expired" and "spend EGP 300 to
 * use it" are different problems with different fixes.
 *
 * The verdict is a PREVIEW, not a promise: `placeOrder` re-checks under a row
 * lock, because a last-redemption coupon can be used up between here and there.
 */
export type CouponPreview =
  | { ok: true; discountPiastres: number }
  | { ok: false; reason: CouponFailure; minSpendPiastres?: number };

export type CouponFailure =
  | 'empty'          // nothing typed
  | 'empty_cart'     // no cart to price against
  | 'not_found'      // no such code
  | 'inactive'       // switched off in admin
  | 'not_started'    // scheduled for later
  | 'expired'
  | 'first_order_only'
  | 'min_spend'
  | 'per_customer'   // this customer already used their allowance
  | 'usage_limit'    // the promo as a whole ran out
  | 'invalid';       // anything the engine did not name

export async function checkCouponAction(input: { code: string; locale?: string }): Promise<CouponPreview> {
  const code = (input.code ?? '').trim();
  if (!code) return { ok: false, reason: 'empty' };

  // Price against what the shopper is actually looking at — the same subtotal
  // the cart shows. A preview computed off a different basis would disagree with
  // the totals on screen, which is worse than no preview.
  const cart = await readCartSnapshot(input.locale === 'ar' ? 'ar' : 'en');
  if (cart.count === 0) return { ok: false, reason: 'empty_cart' };

  const user = await getCurrentUser();
  const customerId = user?.customerId ?? null;
  // Guests are never "first order" — mirrors placeOrder, or a firstOrderOnly
  // coupon would preview as valid for a guest and then fail at placement.
  const isFirstOrder = customerId ? (await prisma.order.count({ where: { customerId } })) === 0 : false;

  const res = await applyCoupon(code, { subtotalPiastres: BigInt(cart.subtotalPiastres), customerId, isFirstOrder });
  if (res.ok) return { ok: true, discountPiastres: Number(res.discountPiastres) };

  // min_spend is the one failure the shopper can act on right now, so it comes
  // with the number they have to reach.
  let minSpendPiastres: number | undefined;
  if (res.reason === 'min_spend') {
    const c = await prisma.coupon.findUnique({ where: { code }, select: { minSpendPiastres: true } });
    if (c?.minSpendPiastres != null) minSpendPiastres = Number(c.minSpendPiastres);
  }
  return { ok: false, reason: res.reason as CouponFailure, minSpendPiastres };
}
