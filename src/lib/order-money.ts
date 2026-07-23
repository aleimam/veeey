/**
 * Pure order-total arithmetic — the one place the money adds up, so it can be
 * unit-tested without a DB. All amounts are EGP piastres (BigInt).
 *
 * Kept separate from `order-service` (which pulls in Prisma/auth) so vitest can
 * exercise the math directly.
 */

/**
 * The APPLIED amount of a staff-added manual discount. It is EITHER a percentage
 * of the subtotal (`pct` set) OR a fixed piastres value (`fixedPiastres`). The
 * result is floored to a whole piastre and capped at the subtotal — you can't
 * discount more than the goods are worth.
 */
export function manualDiscountAmount(subtotal: bigint, pct: number | null | undefined, fixedPiastres: bigint): bigint {
  let amount: bigint;
  if (pct != null && pct > 0) amount = (subtotal * BigInt(Math.round(pct))) / 100n; // BigInt division floors
  else amount = fixedPiastres > 0n ? fixedPiastres : 0n;
  if (amount < 0n) amount = 0n;
  return amount > subtotal ? subtotal : amount;
}

/** subtotal + shipping − coupon/loyalty discount − manual discount, clamped ≥ 0. */
export function orderTotal(p: { subtotal: bigint; shipping: bigint; discount: bigint; manualDiscount: bigint }): bigint {
  const t = p.subtotal + p.shipping - p.discount - p.manualDiscount;
  return t > 0n ? t : 0n;
}

/**
 * What a PAID order still owes (positive) or was overpaid (negative), given the
 * amount actually collected. `null` collected → no delta known (0), so orders paid
 * before this snapshot existed never show a false balance.
 */
export function paidBalance(total: bigint, paidAmount: bigint | null | undefined): bigint {
  if (paidAmount == null) return 0n;
  return total - paidAmount;
}
