import { describe, expect, it } from 'vitest';
import {
  ORDER_STATUSES,
  DEFAULT_STATUS_MAP,
  canTransitionWith,
  customerStatusOf,
  resolveStatusAlias,
  isRevenueStatus,
} from './order-status';

const M = DEFAULT_STATUS_MAP;

describe('order status engine (defaults)', () => {
  it('exposes the fixed 8 system codes', () => {
    expect(ORDER_STATUSES).toHaveLength(8);
    expect([...ORDER_STATUSES]).toContain('PENDING');
    expect([...ORDER_STATUSES]).toContain('DELIVERED');
  });

  it('guards transitions per config allowedNext', () => {
    expect(canTransitionWith(M, 'PENDING', 'CONFIRMED')).toBe(true);
    expect(canTransitionWith(M, 'CONFIRMED', 'SHIPPED')).toBe(true);
    expect(canTransitionWith(M, 'SHIPPED', 'DELIVERED')).toBe(true);
    expect(canTransitionWith(M, 'PENDING', 'DELIVERED')).toBe(false); // can't skip
    expect(canTransitionWith(M, 'CANCELLED', 'CONFIRMED')).toBe(false); // terminal
    expect(canTransitionWith(M, 'PENDING', 'PENDING')).toBe(false); // no self-loop
  });

  it('maps system → customer status (EDIT is invisible)', () => {
    expect(customerStatusOf(M, 'CONFIRMED')).toBe('CONFIRMED');
    expect(customerStatusOf(M, 'DELIVERED')).toBe('DELIVERED');
    expect(customerStatusOf(M, 'EDIT')).toBeNull(); // keeps previous for the customer
  });

  it('resolves legacy / WooCommerce aliases to system codes', () => {
    expect(resolveStatusAlias(M, 'processing')).toBe('CONFIRMED');
    expect(resolveStatusAlias(M, 'completed')).toBe('DELIVERED');
    expect(resolveStatusAlias(M, 'cash delivered')).toBe('DELIVERED');
    expect(resolveStatusAlias(M, 'failed')).toBe('CANCELLED');
    expect(resolveStatusAlias(M, 'pending_confirmation')).toBe('PENDING');
    expect(resolveStatusAlias(M, 'DELIVERED')).toBe('DELIVERED'); // exact code
    expect(resolveStatusAlias(M, 'nonsense')).toBeNull();
  });

  it('flags the revenue-realizing status', () => {
    expect(isRevenueStatus(M, 'DELIVERED')).toBe(true);
    expect(isRevenueStatus(M, 'SHIPPED')).toBe(false);
  });
});
