import { describe, expect, it } from 'vitest';
import { manualDiscountAmount, orderTotal, paidBalance } from './order-money';

describe('manualDiscountAmount', () => {
  it('takes a percentage of the subtotal, floored', () => {
    expect(manualDiscountAmount(12345n, 10, 0n)).toBe(1234n); // 1234.5 → floor
  });

  it('takes a fixed value when no percentage is set', () => {
    expect(manualDiscountAmount(50000n, null, 7500n)).toBe(7500n);
  });

  it('prefers the percentage when both are present', () => {
    expect(manualDiscountAmount(20000n, 25, 999n)).toBe(5000n);
  });

  it('never exceeds the subtotal (can’t discount more than the goods)', () => {
    expect(manualDiscountAmount(3000n, null, 999999n)).toBe(3000n);
    expect(manualDiscountAmount(3000n, 250, 0n)).toBe(3000n); // 250% capped
  });

  it('treats no discount / non-positive input as zero', () => {
    expect(manualDiscountAmount(1000n, null, 0n)).toBe(0n);
    expect(manualDiscountAmount(1000n, 0, 0n)).toBe(0n);
    expect(manualDiscountAmount(1000n, -5, 0n)).toBe(0n);
  });
});

describe('orderTotal', () => {
  it('adds shipping and subtracts both discounts', () => {
    expect(orderTotal({ subtotal: 10000n, shipping: 3000n, discount: 1000n, manualDiscount: 500n })).toBe(11500n);
  });

  it('never goes negative', () => {
    expect(orderTotal({ subtotal: 1000n, shipping: 0n, discount: 800n, manualDiscount: 800n })).toBe(0n);
  });
});

describe('paidBalance', () => {
  it('is positive when the new total exceeds what was collected (owed)', () => {
    expect(paidBalance(15000n, 12000n)).toBe(3000n);
  });

  it('is negative when overpaid (refund owed)', () => {
    expect(paidBalance(9000n, 12000n)).toBe(-3000n);
  });

  it('is zero (no delta) when nothing was ever snapshotted', () => {
    expect(paidBalance(15000n, null)).toBe(0n);
  });
});
