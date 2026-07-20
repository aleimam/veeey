import { describe, it, expect } from 'vitest';
import { effectiveUnitPrice } from './pricing';

const BASE = 10_000n; // 100.00 EGP

describe('effectiveUnitPrice (Codex audit P0: tier price was advertised, never charged)', () => {
  it('charges base when neither a lot override nor a tier price applies', () => {
    expect(effectiveUnitPrice({ basePiastres: BASE })).toBe(BASE);
    expect(effectiveUnitPrice({ basePiastres: BASE, lotOverridePiastres: null, tierPiastres: null })).toBe(BASE);
  });

  it('honours a lot override on its own (short-expiry markdown)', () => {
    expect(effectiveUnitPrice({ basePiastres: BASE, lotOverridePiastres: 7_000n })).toBe(7_000n);
  });

  it('honours a tier price on its own — the case that silently did nothing', () => {
    expect(effectiveUnitPrice({ basePiastres: BASE, tierPiastres: 9_000n })).toBe(9_000n);
  });

  it('gives the customer the better of the two when both apply', () => {
    // Tier beats the markdown…
    expect(effectiveUnitPrice({ basePiastres: BASE, lotOverridePiastres: 9_000n, tierPiastres: 8_000n })).toBe(8_000n);
    // …and the markdown beats a weaker tier rule, rather than being erased by it.
    expect(effectiveUnitPrice({ basePiastres: BASE, lotOverridePiastres: 6_000n, tierPiastres: 9_500n })).toBe(6_000n);
  });

  it('never charges a tier member MORE than the shelf price', () => {
    // A tier rule that somehow resolves above the lot price must not apply.
    expect(effectiveUnitPrice({ basePiastres: BASE, lotOverridePiastres: 5_000n, tierPiastres: BASE })).toBe(5_000n);
  });

  it('handles a lot override ABOVE base (open-box repricing) without inventing a discount', () => {
    expect(effectiveUnitPrice({ basePiastres: BASE, lotOverridePiastres: 12_000n })).toBe(12_000n);
  });

  it('supports a free line (100% tier discount) without going negative', () => {
    expect(effectiveUnitPrice({ basePiastres: BASE, tierPiastres: 0n })).toBe(0n);
  });
});
