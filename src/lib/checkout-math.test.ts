import { describe, expect, it } from 'vitest';
import { orderTotal, depositAndBalance, pointsEarned } from './checkout-math';
import { scoreOrderRisk } from './fraud';

describe('checkout math', () => {
  it('orderTotal sums subtotal + shipping − discount, floored at 0', () => {
    expect(orderTotal(85000n, 40000n, 0n)).toBe(125000n); // 850 + 400 shipping
    expect(orderTotal(10000n, 0n, 50000n)).toBe(0n);
  });

  it('depositAndBalance: full payment vs 25% deposit', () => {
    expect(depositAndBalance(100000n, false)).toEqual({ depositPiastres: 100000n, balancePiastres: 0n });
    expect(depositAndBalance(100000n, true)).toEqual({ depositPiastres: 25000n, balancePiastres: 75000n });
  });

  it('depositAndBalance: honors a configured rate and clamps it to 0–100', () => {
    expect(depositAndBalance(100000n, true, 40)).toEqual({ depositPiastres: 40000n, balancePiastres: 60000n });
    expect(depositAndBalance(100000n, true, 0)).toEqual({ depositPiastres: 0n, balancePiastres: 100000n });
    expect(depositAndBalance(100000n, true, 150)).toEqual({ depositPiastres: 100000n, balancePiastres: 0n }); // clamped to 100
    expect(depositAndBalance(100000n, false, 40)).toEqual({ depositPiastres: 100000n, balancePiastres: 0n }); // no deposit → full
  });

  it('pointsEarned scales subtotal by tier rate', () => {
    expect(pointsEarned(85000n, 1)).toBe(850); // 850 EGP × 1 pt
    expect(pointsEarned(85000n, 3)).toBe(2550); // Select tier
  });
});

describe('fraud scoring', () => {
  it('a normal in-stock member order is low risk', () => {
    const r = scoreOrderRisk({ totalPiastres: 90000, isGuest: false, itemCount: 2, paymentMethod: 'KASHIER', recentOrders24h: 0, addressProvided: true });
    expect(r.level).toBe('low');
    expect(r.flags).toHaveLength(0);
  });

  it('high-value guest COD with velocity is high risk', () => {
    const r = scoreOrderRisk({ totalPiastres: 6_000_000, isGuest: true, itemCount: 3, paymentMethod: 'COD', recentOrders24h: 4, addressProvided: true });
    expect(r.level).toBe('high');
    expect(r.flags).toEqual(expect.arrayContaining(['guest_checkout', 'high_value', 'high_value_cod', 'order_velocity']));
  });
});
