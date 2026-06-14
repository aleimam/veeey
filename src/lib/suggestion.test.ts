import { describe, expect, it } from 'vitest';
import { suggestDiscountPct, discountedPiastres } from './suggestion';

describe('suggestDiscountPct', () => {
  it('suggests nothing for far-off expiry with healthy turnover', () => {
    const s = suggestDiscountPct({ daysToExpiry: 200, stockQty: 10, monthlyVelocity: 5, consumptionDays: 90 });
    expect(s.pct).toBe(0);
  });

  it('bands by days-to-expiry and pushes harder on surplus', () => {
    // 45d -> band 20; projected sales (1.5) << half stock (50) -> +5 = 25
    const s = suggestDiscountPct({ daysToExpiry: 45, stockQty: 100, monthlyVelocity: 1, consumptionDays: 30 });
    expect(s.pct).toBe(25);
  });

  it('caps at 40 and bumps when a unit cannot be finished in time', () => {
    // 20d -> band 30; surplus +5 = 35; daysToExpiry < consumptionDays (30) -> +10 -> cap 40
    const s = suggestDiscountPct({ daysToExpiry: 20, stockQty: 50, monthlyVelocity: 0, consumptionDays: 30 });
    expect(s.pct).toBe(40);
  });

  it('never discounts an already-expired lot', () => {
    const s = suggestDiscountPct({ daysToExpiry: 0, stockQty: 5, monthlyVelocity: 0, consumptionDays: 0 });
    expect(s.pct).toBe(0);
    expect(s.reason).toMatch(/write off/i);
  });
});

describe('discountedPiastres', () => {
  it('applies a percentage to a piastres price', () => {
    expect(discountedPiastres(85000n, 30)).toBe(59500n); // 850 EGP -30% = 595 EGP
    expect(discountedPiastres(100000n, 0)).toBe(100000n);
  });
});
