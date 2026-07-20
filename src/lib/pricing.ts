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

/**
 * The unit price a customer actually pays for one unit of a bound lot.
 *
 * Two independent discounts can apply and they must not cancel each other out:
 *   - the LOT override — a per-expiry markdown on that specific lot;
 *   - the TIER price  — this customer's FR-PRC-03 rules on the product.
 *
 * The customer gets whichever is lower. A Select member must never pay more
 * than a guest looking at the same shelf, and a short-expiry markdown must not
 * be erased by a tier rule that happens to be smaller.
 *
 * Until this existed the tier price was computed for the PDP teaser only and
 * thrown away — cart, checkout and the order line all charged the lot/base
 * price, so an advertised tier discount was never actually granted (Codex
 * audit P0). Pure so every surface shares one answer.
 */
export function effectiveUnitPrice(args: {
  basePiastres: bigint;
  lotOverridePiastres?: bigint | null;
  tierPiastres?: bigint | null;
}): bigint {
  // The lot's own price is the shelf price — an override can sit ABOVE base
  // (a premium/open-box repricing), so it must not be treated as a ceiling of
  // base. Defaulting a missing tier price to base would do exactly that and
  // quietly undercharge such lots.
  const lot = args.lotOverridePiastres ?? args.basePiastres;
  if (args.tierPiastres == null) return lot;
  return args.tierPiastres < lot ? args.tierPiastres : lot;
}
