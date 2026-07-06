/**
 * Pure checkout money math (piastres BigInt). Deposit mode charges a percentage
 * up front with the balance on delivery for pre/special orders (FR-CHK-03). The
 * rate is admin-configurable (preorder.depositPercent / specialOrder.depositPercent),
 * defaulting to 25%.
 */
export const DEPOSIT_PCT = 25n;

export function orderTotal(
  subtotalPiastres: bigint,
  shippingPiastres: bigint,
  discountPiastres: bigint = 0n,
): bigint {
  const total = subtotalPiastres + shippingPiastres - discountPiastres;
  return total < 0n ? 0n : total;
}

export function depositAndBalance(
  totalPiastres: bigint,
  requiresDeposit: boolean,
  depositPct: number | bigint = DEPOSIT_PCT,
): { depositPiastres: bigint; balancePiastres: bigint } {
  if (!requiresDeposit) return { depositPiastres: totalPiastres, balancePiastres: 0n };
  // Clamp the configured rate to a sane 0–100 band before applying it.
  const pct = BigInt(Math.max(0, Math.min(100, Math.round(Number(depositPct)))));
  const depositPiastres = (totalPiastres * pct) / 100n;
  return { depositPiastres, balancePiastres: totalPiastres - depositPiastres };
}

/** Loyalty points earned for an order subtotal at a tier earn-rate (pts per EGP). */
export function pointsEarned(subtotalPiastres: bigint, earnRatePerEgp: number): number {
  return Math.floor((Number(subtotalPiastres) / 100) * earnRatePerEgp);
}
