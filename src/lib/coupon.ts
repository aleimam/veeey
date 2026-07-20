/**
 * Advanced coupon engine (FR-PRC-07). Pure validation + discount calc; service
 * layer handles usage limits / single-use / per-customer caps against the DB.
 */
export type CouponData = {
  type: 'PERCENT' | 'FIXED' | 'FREE_ITEM';
  value: number;
  minSpendPiastres?: bigint | null;
  firstOrderOnly: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
  active: boolean;
};

export type CouponContext = { subtotalPiastres: bigint; isFirstOrder: boolean; now: Date };
export type CouponCheck = { valid: boolean; reason?: string };

export function checkCoupon(c: CouponData, ctx: CouponContext): CouponCheck {
  if (!c.active) return { valid: false, reason: 'inactive' };
  if (c.startsAt && ctx.now < c.startsAt) return { valid: false, reason: 'not_started' };
  if (c.endsAt && ctx.now > c.endsAt) return { valid: false, reason: 'expired' };
  if (c.firstOrderOnly && !ctx.isFirstOrder) return { valid: false, reason: 'first_order_only' };
  if (c.minSpendPiastres != null && ctx.subtotalPiastres < c.minSpendPiastres) return { valid: false, reason: 'min_spend' };
  return { valid: true };
}

/** Discount in piastres (never more than the subtotal). FREE_ITEM is handled in the service. */
export function couponDiscount(c: CouponData, subtotalPiastres: bigint): bigint {
  let d = 0n;
  if (c.type === 'PERCENT') d = (subtotalPiastres * BigInt(Math.round(c.value * 100))) / 10_000n;
  else if (c.type === 'FIXED') d = BigInt(Math.round(c.value * 100)); // value is EGP
  return d > subtotalPiastres ? subtotalPiastres : d;
}

/**
 * Redemption caps as PURE logic, so the checkout claim and the price quote
 * can't disagree about what "used up" means (Codex audit P0).
 *
 * `singleUse` is just a cap of 1 — it used to be a separate branch, which is
 * how it drifted out of sync with `usageLimit`.
 */
export type CouponLimits = { singleUse: boolean; usageLimit: number | null; perCustomerLimit: number | null };

export function couponLimitReached(
  limits: CouponLimits,
  used: { total: number; byCustomer: number | null },
): boolean {
  const cap = limits.singleUse ? 1 : limits.usageLimit;
  if (cap != null && used.total >= cap) return true;
  if (limits.perCustomerLimit != null && used.byCustomer != null && used.byCustomer >= limits.perCustomerLimit) return true;
  return false;
}
