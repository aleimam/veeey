import { describe, it, expect } from 'vitest';
import { ruleMatches, matchGiftRules, nearestSubtotalRule, type GiftRuleRef, type GiftRuleCtx } from './gift-rules';

const rule = (over: Partial<GiftRuleRef> = {}): GiftRuleRef => ({
  id: 'r1', nameEn: 'Free shaker', nameAr: 'شيكر مجاني', giftId: 'g1', giftQty: 1, active: true,
  minSubtotalPiastres: 100_000n, productId: null, categoryId: null, startsAt: null, endsAt: null, ...over,
});

const ctx = (over: Partial<GiftRuleCtx> = {}): GiftRuleCtx => ({
  subtotalPiastres: 150_000n, productIds: ['p1', 'p2'], categoryIds: ['c1'], now: new Date('2026-07-11T12:00:00Z'), ...over,
});

describe('ruleMatches', () => {
  it('subtotal threshold', () => {
    expect(ruleMatches(rule(), ctx())).toBe(true);
    expect(ruleMatches(rule(), ctx({ subtotalPiastres: 99_999n }))).toBe(false);
    expect(ruleMatches(rule(), ctx({ subtotalPiastres: 100_000n }))).toBe(true); // inclusive
  });

  it('product / category conditions AND together', () => {
    const r = rule({ productId: 'p1', categoryId: 'c1' });
    expect(ruleMatches(r, ctx())).toBe(true);
    expect(ruleMatches(r, ctx({ productIds: ['p9'] }))).toBe(false);
    expect(ruleMatches(r, ctx({ categoryIds: ['c9'] }))).toBe(false);
  });

  it('schedule window + inactive + unconditioned rules', () => {
    expect(ruleMatches(rule({ active: false }), ctx())).toBe(false);
    expect(ruleMatches(rule({ startsAt: new Date('2026-08-01') }), ctx())).toBe(false);
    expect(ruleMatches(rule({ endsAt: new Date('2026-07-01') }), ctx())).toBe(false);
    // No conditions at all → never matches (would gift every order).
    expect(ruleMatches(rule({ minSubtotalPiastres: null }), ctx())).toBe(false);
  });
});

describe('matchGiftRules', () => {
  it('collapses duplicate gifts to the largest qty', () => {
    const grants = matchGiftRules(
      [rule({ id: 'a', giftQty: 1 }), rule({ id: 'b', giftQty: 2 }), rule({ id: 'c', giftId: 'g2', minSubtotalPiastres: 1n })],
      ctx(),
    );
    expect(grants).toHaveLength(2);
    expect(grants.find((g) => g.giftId === 'g1')?.qty).toBe(2);
    expect(grants.find((g) => g.giftId === 'g2')?.ruleId).toBe('c');
  });

  it('empty when nothing matches', () => {
    expect(matchGiftRules([rule()], ctx({ subtotalPiastres: 0n }))).toEqual([]);
  });
});

describe('nearestSubtotalRule', () => {
  it('picks the closest unmet subtotal-only rule', () => {
    const r1 = rule({ id: 'far', minSubtotalPiastres: 500_000n });
    const r2 = rule({ id: 'near', minSubtotalPiastres: 200_000n });
    const hit = nearestSubtotalRule([r1, r2], ctx());
    expect(hit?.rule.id).toBe('near');
    expect(hit?.remainingPiastres).toBe(50_000n);
  });

  it('ignores met rules, conditioned rules, and inactive rules', () => {
    expect(nearestSubtotalRule([rule()], ctx())).toBeNull(); // already earned
    expect(nearestSubtotalRule([rule({ minSubtotalPiastres: 500_000n, productId: 'p1' })], ctx())).toBeNull();
    expect(nearestSubtotalRule([rule({ minSubtotalPiastres: 500_000n, active: false })], ctx())).toBeNull();
  });
});
