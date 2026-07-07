import { describe, it, expect } from 'vitest';
import { buildFunnel } from './analytics';

describe('buildFunnel', () => {
  it('each stage rate is its share of the top of the funnel (0–100%)', () => {
    const f = buildFunnel({ views: 100, carts: 40, checkouts: 20, orders: 10 });
    expect(f.map((s) => s.count)).toEqual([100, 40, 20, 10]);
    expect(f[0].rate).toBe(1);
    expect(f[1].rate).toBeCloseTo(0.4);
    expect(f[2].rate).toBeCloseTo(0.2);
    expect(f[3].rate).toBeCloseTo(0.1);
  });

  it('clamps a downstream stage that exceeds the top — no impossible >100%', () => {
    // The exact case from the audit: orders (295) ≫ views (32) used to show 29500%.
    const f = buildFunnel({ views: 32, carts: 0, checkouts: 0, orders: 295 });
    expect(f[3].rate).toBe(1);
    expect(f[1].rate).toBe(0);
  });

  it('handles an all-zero funnel without dividing by zero', () => {
    const f = buildFunnel({ views: 0, carts: 0, checkouts: 0, orders: 0 });
    expect(f[0].rate).toBe(1);
    expect(f.slice(1).every((s) => s.rate === 0)).toBe(true);
  });
});
