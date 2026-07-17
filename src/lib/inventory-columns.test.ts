import { describe, it, expect } from 'vitest';
import { summarizeLots, marginOf, type LotLite } from './inventory-columns';

const lot = (productId: string, onHand: number, reserved = 0, costEgp: number | null = null): LotLite => ({
  productId, qtyOnHand: onHand, qtyReserved: reserved, costPiastres: costEgp == null ? null : BigInt(costEgp * 100),
});

// V7 audit C13: stock + margin columns on the products list.
describe('summarizeLots', () => {
  it('sums available units as on-hand minus reserved, per product', () => {
    const m = summarizeLots([lot('p1', 10, 3), lot('p1', 5), lot('p2', 2, 2)]);
    expect(m.get('p1')!.available).toBe(12);
    expect(m.get('p2')!.available).toBe(0);
  });

  it('never lets an over-reserved lot subtract below zero', () => {
    const m = summarizeLots([lot('p1', 2, 5), lot('p1', 4)]);
    expect(m.get('p1')!.available).toBe(4);
  });

  it('weights average cost by on-hand quantity', () => {
    // 10 units @ 100 EGP + 30 units @ 200 EGP → 175 EGP.
    const m = summarizeLots([lot('p1', 10, 0, 100), lot('p1', 30, 0, 200)]);
    expect(m.get('p1')!.avgCostPiastres).toBe(17500);
  });

  it('reports null cost when no lot carries one — a dash beats a made-up figure', () => {
    const m = summarizeLots([lot('p1', 10)]);
    expect(m.get('p1')!.avgCostPiastres).toBeNull();
  });

  it('a costed but empty lot still informs the average instead of vanishing', () => {
    const m = summarizeLots([lot('p1', 0, 0, 100)]);
    expect(m.get('p1')!.avgCostPiastres).toBe(10000);
  });
});

describe('marginOf', () => {
  it('computes margin and percent against the base price', () => {
    expect(marginOf(50000, 30000)).toEqual({ piastres: 20000, pct: 40 });
  });

  it('can be negative — selling below cost must be visible, not clamped', () => {
    expect(marginOf(20000, 30000)).toEqual({ piastres: -10000, pct: -50 });
  });

  it('is null without a recorded cost', () => {
    expect(marginOf(50000, null)).toBeNull();
  });

  it('handles a zero base price without dividing by zero', () => {
    expect(marginOf(0, 10000)).toEqual({ piastres: -10000, pct: 0 });
  });
});
