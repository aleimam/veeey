import { describe, expect, it } from 'vitest';
import { weightedAverageCost } from './lot-costing';

describe('weightedAverageCost (owner decision: weighted average)', () => {
  it('weights by quantity, not by line count', () => {
    // 10 units at 100 + 90 units at 200 → 190, not the naive 150.
    expect(weightedAverageCost(10, 100n, 90, 200n)).toBe(190n);
  });

  it('keeps the lot total equal to what was actually paid', () => {
    const avg = weightedAverageCost(3, 500n, 2, 1000n)!; // 1500 + 2000 = 3500 over 5
    expect(avg).toBe(700n);
    expect(avg * 5n).toBe(3500n);
  });

  it('is a no-op when both prices already agree', () => {
    expect(weightedAverageCost(7, 4825n, 3, 4825n)).toBe(4825n);
  });

  it('rounds half UP to the nearest piastre', () => {
    // (1 × 100 + 1 × 101) / 2 = 100.5
    expect(weightedAverageCost(1, 100n, 1, 101n)).toBe(101n);
    // (1 × 100 + 1 × 102) / 2 = 101 exactly — no rounding to do
    expect(weightedAverageCost(1, 100n, 1, 102n)).toBe(101n);
  });

  it('leaves the existing cost alone when the arriving one is unknown', () => {
    // Averaging against a missing number would quietly write down the whole lot.
    expect(weightedAverageCost(10, 500n, 5, null)).toBe(500n);
  });

  it('adopts the arriving cost when the lot has none — better than a lot worth nothing', () => {
    expect(weightedAverageCost(10, null, 5, 500n)).toBe(500n);
  });

  it('returns null only when neither side knows a price', () => {
    expect(weightedAverageCost(10, null, 5, null)).toBeNull();
  });

  it('takes the arriving price outright when the shelf is empty', () => {
    // A sold-out lot being restocked is priced by the new purchase, not by a
    // cost that now applies to zero units.
    expect(weightedAverageCost(0, 100n, 5, 900n)).toBe(900n);
    expect(weightedAverageCost(-4, 100n, 5, 900n)).toBe(900n);
  });

  it('ignores a non-positive arrival', () => {
    expect(weightedAverageCost(10, 100n, 0, 900n)).toBe(100n);
  });

  it('handles piastre-scale numbers without float drift', () => {
    // 12.50 USD × 48.5 = 60,625 piastres; 40 units of it against 60 at 51,000.
    expect(weightedAverageCost(60, 51_000n, 40, 60_625n)).toBe(54_850n);
  });
});
