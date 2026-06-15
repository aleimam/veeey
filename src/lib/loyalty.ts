/**
 * Loyalty points (FR-PRC-02/04). Earn by tier (1/2/3 pts per EGP, configurable);
 * redeem at **200 points = 1 EGP**. Points stack with coupons + tier discounts.
 * Pure + unit-tested.
 */
export const REDEEM_POINTS_PER_EGP = 200;

/** Points earned on a subtotal at a tier's earn rate (pts per EGP). */
export function earnedPoints(subtotalPiastres: bigint, earnRatePerEgp: number): number {
  return Math.floor((Number(subtotalPiastres) / 100) * earnRatePerEgp);
}

/** Monetary value (piastres) of redeeming `points` — whole EGP only.
 *  `rate` (points per EGP) is admin-configurable; defaults to the seeded 200. */
export function pointsToPiastres(points: number, rate: number = REDEEM_POINTS_PER_EGP): bigint {
  const r = rate >= 1 ? rate : REDEEM_POINTS_PER_EGP;
  return BigInt(Math.floor(points / r) * 100);
}

/** Most points usable: capped by the customer's balance and the order value. */
export function maxRedeemablePoints(balance: number, capPiastres: bigint, rate: number = REDEEM_POINTS_PER_EGP): number {
  const r = rate >= 1 ? rate : REDEEM_POINTS_PER_EGP;
  const maxByCap = Math.floor(Number(capPiastres) / 100) * r;
  return Math.max(0, Math.min(balance, maxByCap));
}
