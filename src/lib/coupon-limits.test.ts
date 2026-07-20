import { describe, it, expect } from 'vitest';
import { couponLimitReached } from './coupon';

const none = { singleUse: false, usageLimit: null, perCustomerLimit: null };

describe('couponLimitReached (Codex audit P0: redemption caps were exceedable)', () => {
  it('treats singleUse as a cap of exactly 1', () => {
    const l = { ...none, singleUse: true };
    expect(couponLimitReached(l, { total: 0, byCustomer: 0 })).toBe(false);
    expect(couponLimitReached(l, { total: 1, byCustomer: 1 })).toBe(true);
  });

  it('blocks at — not after — the usage limit', () => {
    const l = { ...none, usageLimit: 3 };
    expect(couponLimitReached(l, { total: 2, byCustomer: null })).toBe(false);
    expect(couponLimitReached(l, { total: 3, byCustomer: null })).toBe(true);
    // The race this guards: a second checkout that counted 3 must be refused,
    // not allowed through to a 4th redemption.
    expect(couponLimitReached(l, { total: 4, byCustomer: null })).toBe(true);
  });

  it('enforces the per-customer cap independently of the global one', () => {
    const l = { ...none, usageLimit: 100, perCustomerLimit: 1 };
    expect(couponLimitReached(l, { total: 50, byCustomer: 0 })).toBe(false);
    expect(couponLimitReached(l, { total: 50, byCustomer: 1 })).toBe(true);
  });

  it('ignores the per-customer cap for guests (no customer to count against)', () => {
    const l = { ...none, perCustomerLimit: 1 };
    expect(couponLimitReached(l, { total: 99, byCustomer: null })).toBe(false);
  });

  it('never blocks an uncapped coupon', () => {
    expect(couponLimitReached(none, { total: 10_000, byCustomer: 500 })).toBe(false);
  });

  it('singleUse wins over a larger usageLimit', () => {
    const l = { singleUse: true, usageLimit: 50, perCustomerLimit: null };
    expect(couponLimitReached(l, { total: 1, byCustomer: null })).toBe(true);
  });
});
