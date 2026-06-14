/**
 * Short-expiry discount suggestion engine (FR-INV-05). The system *suggests* a
 * discount from days-to-expiry, stock level, recent sales velocity, and the
 * expected consumption duration; a **pharmacist confirms** before it goes live.
 *
 * The bands are seeded defaults and admin-configurable (open decision #4 —
 * price-per-expiry discount bands), never a hard-coded business rule.
 */

export type DiscountBand = { maxDays: number; pct: number };

export const DEFAULT_DISCOUNT_BANDS: DiscountBand[] = [
  { maxDays: 30, pct: 30 },
  { maxDays: 60, pct: 20 },
  { maxDays: 90, pct: 10 },
  { maxDays: 180, pct: 5 },
];

const MAX_PCT = 40;

export type SuggestionInput = {
  daysToExpiry: number;
  stockQty: number;
  /** Units sold per month (e.g. trailing 90-day average). */
  monthlyVelocity: number;
  /** Days one unit lasts a customer = f(size, dosage). 0 if unknown. */
  consumptionDays: number;
};

export type Suggestion = { pct: number; reason: string };

/** Suggested discount %, with a human-readable reason. 0 = no discount needed. */
export function suggestDiscountPct(
  input: SuggestionInput,
  bands: DiscountBand[] = DEFAULT_DISCOUNT_BANDS,
): Suggestion {
  const { daysToExpiry, stockQty, monthlyVelocity, consumptionDays } = input;

  if (daysToExpiry <= 0) {
    return { pct: 0, reason: 'Expired — write off, do not discount.' };
  }

  // Base band by time-to-expiry.
  const band = [...bands].sort((a, b) => a.maxDays - b.maxDays).find((b) => daysToExpiry <= b.maxDays);
  let pct = band?.pct ?? 0;

  // Will it sell through in time at the current pace? If projected sales cover
  // the stock comfortably, ease off the discount.
  const monthsLeft = daysToExpiry / 30;
  const projectedSales = monthlyVelocity * monthsLeft;
  if (pct > 0 && projectedSales >= stockQty * 1.2) {
    pct = Math.max(0, pct - 10);
  } else if (projectedSales < stockQty * 0.5) {
    // Lots of surplus relative to demand → push harder.
    pct = Math.min(MAX_PCT, pct + 5);
  }

  // If a customer can't even finish one unit before it expires, it's hard to
  // sell at full price — nudge the discount up.
  if (consumptionDays > 0 && daysToExpiry < consumptionDays) {
    pct = Math.min(MAX_PCT, pct + 10);
  }

  if (pct <= 0) return { pct: 0, reason: 'Healthy expiry & turnover — no discount suggested.' };
  return {
    pct,
    reason: `${daysToExpiry}d to expiry, ${stockQty} in stock, ~${monthlyVelocity.toFixed(1)}/mo velocity.`,
  };
}

/** Apply a percentage discount to a base price in piastres (rounded). */
export function discountedPiastres(basePiastres: bigint, pct: number): bigint {
  return (basePiastres * BigInt(Math.round((100 - pct) * 100))) / 10_000n;
}
