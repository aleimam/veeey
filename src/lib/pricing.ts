/**
 * Per-tier pricing (FR-PRC-03). A tier's product rules (matched by category/tag/
 * attribute) carry price modifiers; the customer gets the single best (largest)
 * discount among the applicable rules. Pure + unit-tested.
 */
export type PriceModifier = { type: 'PERCENT' | 'FIXED'; value: number };

export function applyTierPrice(basePiastres: bigint, modifiers: PriceModifier[]): bigint {
  let best = basePiastres;
  for (const m of modifiers) {
    const candidate =
      m.type === 'PERCENT'
        ? (basePiastres * BigInt(Math.round((100 - m.value) * 100))) / 10_000n
        : basePiastres - BigInt(Math.round(m.value * 100)); // FIXED value is EGP off
    const clamped = candidate < 0n ? 0n : candidate;
    if (clamped < best) best = clamped;
  }
  return best;
}
