/**
 * Pure checkout money math (piastres BigInt). Deposit mode charges 25% up front
 * with the balance on delivery for pre/special orders (FR-CHK-03). The rate is a
 * seeded default (admin-configurable later).
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
): { depositPiastres: bigint; balancePiastres: bigint } {
  if (!requiresDeposit) return { depositPiastres: totalPiastres, balancePiastres: 0n };
  const depositPiastres = (totalPiastres * DEPOSIT_PCT) / 100n;
  return { depositPiastres, balancePiastres: totalPiastres - depositPiastres };
}

/** Loyalty points earned for an order subtotal at a tier earn-rate (pts per EGP). */
export function pointsEarned(subtotalPiastres: bigint, earnRatePerEgp: number): number {
  return Math.floor((Number(subtotalPiastres) / 100) * earnRatePerEgp);
}
