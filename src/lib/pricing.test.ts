import { describe, expect, it } from 'vitest';
import { applyTierPrice } from './pricing';
import { earnedPoints, pointsToPiastres, maxRedeemablePoints } from './loyalty';
import { checkCoupon, couponDiscount, type CouponData } from './coupon';

describe('tier pricing', () => {
  it('applies a percentage tier discount', () => {
    expect(applyTierPrice(100000n, [{ type: 'PERCENT', value: 10 }])).toBe(90000n);
  });
  it('applies a fixed EGP-off tier discount', () => {
    expect(applyTierPrice(100000n, [{ type: 'FIXED', value: 50 }])).toBe(95000n);
  });
  it('takes the best of several rules and never goes negative', () => {
    expect(applyTierPrice(100000n, [{ type: 'PERCENT', value: 10 }, { type: 'FIXED', value: 30 }])).toBe(90000n);
    expect(applyTierPrice(10000n, [{ type: 'FIXED', value: 999 }])).toBe(0n);
  });
  it('no rules → base price', () => {
    expect(applyTierPrice(100000n, [])).toBe(100000n);
  });
});

describe('loyalty', () => {
  it('earns by tier rate', () => {
    expect(earnedPoints(85000n, 1)).toBe(850);
    expect(earnedPoints(85000n, 3)).toBe(2550);
  });
  it('redeems 200 points = 1 EGP (whole EGP)', () => {
    expect(pointsToPiastres(450)).toBe(200n); // floor(450/200)=2 EGP
    expect(pointsToPiastres(199)).toBe(0n);
  });
  it('caps redeemable points by balance and order value', () => {
    expect(maxRedeemablePoints(300, 50000n)).toBe(300); // balance binds
    expect(maxRedeemablePoints(200000, 50000n)).toBe(100000); // order value (500 EGP × 200) binds
  });
  it('honors a configurable redemption rate', () => {
    expect(pointsToPiastres(450, 100)).toBe(400n); // 100 pts = 1 EGP → 4 EGP
    expect(maxRedeemablePoints(200000, 50000n, 100)).toBe(50000); // 500 EGP × 100
    expect(pointsToPiastres(450, 0)).toBe(200n); // invalid rate falls back to default 200
  });
});

describe('coupon engine', () => {
  const base: CouponData = { type: 'PERCENT', value: 20, firstOrderOnly: false, active: true };
  const now = new Date('2026-06-14');

  it('validates an active coupon', () => {
    expect(checkCoupon(base, { subtotalPiastres: 100000n, isFirstOrder: false, now }).valid).toBe(true);
  });
  it('rejects inactive / expired / min-spend / first-order', () => {
    expect(checkCoupon({ ...base, active: false }, { subtotalPiastres: 100000n, isFirstOrder: false, now }).reason).toBe('inactive');
    expect(checkCoupon({ ...base, endsAt: new Date('2026-01-01') }, { subtotalPiastres: 100000n, isFirstOrder: false, now }).reason).toBe('expired');
    expect(checkCoupon({ ...base, minSpendPiastres: 200000n }, { subtotalPiastres: 100000n, isFirstOrder: false, now }).reason).toBe('min_spend');
    expect(checkCoupon({ ...base, firstOrderOnly: true }, { subtotalPiastres: 100000n, isFirstOrder: false, now }).reason).toBe('first_order_only');
  });
  it('computes percent and fixed discounts, capped at subtotal', () => {
    expect(couponDiscount(base, 100000n)).toBe(20000n);
    expect(couponDiscount({ ...base, type: 'FIXED', value: 50 }, 100000n)).toBe(5000n);
    expect(couponDiscount({ ...base, type: 'FIXED', value: 9999 }, 10000n)).toBe(10000n);
  });
});
