import { describe, expect, it } from 'vitest';
import {
  ORDER_STATUSES,
  DEFAULT_STATUS_MAP,
  canTransitionWith,
  customerStatusOf,
  resolveStatusAlias,
  isRevenueStatus,
  restockOnCancel,
  stockEffectApplies,
} from './order-status';

const M = DEFAULT_STATUS_MAP;

describe('order status engine (defaults)', () => {
  it('exposes the fixed system codes (9 incl. RETURNED)', () => {
    expect(ORDER_STATUSES).toHaveLength(9);
    expect([...ORDER_STATUSES]).toContain('PENDING');
    expect([...ORDER_STATUSES]).toContain('DELIVERED');
    expect([...ORDER_STATUSES]).toContain('RETURNED');
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

describe('Phase-1 restock rules (owner: deduct at placement, restock on return-or-unshipped-cancel)', () => {
  it('cancelling an UNSHIPPED order restocks (goods still on the shelf)', () => {
    for (const from of ['PENDING', 'CONFIRMED', 'HOLD', 'EDIT']) {
      expect(restockOnCancel(from)).toBe(true);
      expect(stockEffectApplies('restock_if_unshipped', from)).toBe(true);
    }
  });

  it('cancelling a SHIPPED/DELIVERED order does NOT restock (goods gone → wait for return)', () => {
    for (const from of ['SHIPPED', 'DELIVERED']) {
      expect(restockOnCancel(from)).toBe(false);
      expect(stockEffectApplies('restock_if_unshipped', from)).toBe(false);
    }
  });

  it("respects the CURRENT status: ship → unship → Confirmed is treated as unshipped", () => {
    // The order is Confirmed now (was unshipped), so a cancel from here restocks.
    expect(stockEffectApplies('restock_if_unshipped', 'CONFIRMED')).toBe(true);
  });

  it('RETURNED (restock) always restores, regardless of prior status', () => {
    for (const from of ['SHIPPED', 'DELIVERED', 'CANCELLED', 'CONFIRMED']) {
      expect(stockEffectApplies('restock', from)).toBe(true);
    }
  });

  it('never restocks when the effect is none (Refunded moves money, not stock)', () => {
    expect(stockEffectApplies('none', 'CONFIRMED')).toBe(false);
    expect(stockEffectApplies('none', 'DELIVERED')).toBe(false);
  });

  it('config: Cancelled=restock_if_unshipped, Refunded=none, Returned=restock', () => {
    expect(DEFAULT_STATUS_MAP.get('CANCELLED')!.stockEffect).toBe('restock_if_unshipped');
    expect(DEFAULT_STATUS_MAP.get('REFUNDED')!.stockEffect).toBe('none');
    expect(DEFAULT_STATUS_MAP.get('RETURNED')!.stockEffect).toBe('restock');
  });

  it('transition graph: Cancelled/Delivered/Shipped can reach Returned; Shipped can be unshipped', () => {
    expect(canTransitionWith(DEFAULT_STATUS_MAP, 'CANCELLED', 'RETURNED')).toBe(true);
    expect(canTransitionWith(DEFAULT_STATUS_MAP, 'DELIVERED', 'RETURNED')).toBe(true);
    expect(canTransitionWith(DEFAULT_STATUS_MAP, 'SHIPPED', 'CONFIRMED')).toBe(true); // unship
    expect(canTransitionWith(DEFAULT_STATUS_MAP, 'DELIVERED', 'CANCELLED')).toBe(true);
  });
});
