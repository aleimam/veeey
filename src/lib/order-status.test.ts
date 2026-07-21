import { describe, expect, it } from 'vitest';
import {
  ORDER_STATUSES,
  DEFAULT_STATUS_MAP,
  DEFAULT_ADVANCE_PERMISSION,
  canTransitionWith,
  advancePermissionFor,
  fastActionsFrom,
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

describe('Status Matrix — advance permission + fast actions (STAT)', () => {
  it('advancePermissionFor resolves the configured key, falling back to the baseline', () => {
    expect(advancePermissionFor(M, 'CONFIRMED')).toBe('orders.write'); // owner: only Sales confirm
    expect(advancePermissionFor(M, 'SHIPPED')).toBe('orders.fulfill');
    expect(advancePermissionFor(M, 'DELIVERED')).toBe('orders.fulfill');
    expect(advancePermissionFor(M, 'REFUNDED')).toBe('finance.manage');
    expect(advancePermissionFor(M, 'RETURNED')).toBe('returns.manage');
    expect(advancePermissionFor(M, 'PENDING')).toBe(DEFAULT_ADVANCE_PERMISSION); // null → baseline
    expect(advancePermissionFor(M, 'NOPE')).toBe(DEFAULT_ADVANCE_PERMISSION); // unknown → baseline
  });

  it('config: the three common advances are fast actions; terminals are not', () => {
    for (const c of ['CONFIRMED', 'SHIPPED', 'DELIVERED']) expect(M.get(c)!.fastAction).toBe(true);
    for (const c of ['CANCELLED', 'REFUNDED', 'RETURNED', 'PENDING', 'HOLD', 'EDIT']) expect(M.get(c)!.fastAction).toBe(false);
  });

  it('fastActionsFrom returns only reachable + fast + permitted targets', () => {
    const codes = (from: string, perms: string[]) => fastActionsFrom(M, from, perms).map((c) => c.code);
    // Sales (orders.write) can fast-Confirm a pending order…
    expect(codes('PENDING', ['orders.write'])).toEqual(['CONFIRMED']);
    // …but cannot fast-Ship (SHIPPED needs orders.fulfill).
    expect(codes('CONFIRMED', ['orders.write'])).toEqual([]);
    // Operations (orders.fulfill) can fast-Ship from Confirmed and fast-Deliver from Shipped.
    expect(codes('CONFIRMED', ['orders.fulfill'])).toEqual(['SHIPPED']);
    expect(codes('SHIPPED', ['orders.fulfill'])).toEqual(['DELIVERED']);
    // Delivered's next steps (Refunded/Cancelled/Returned) are not fast actions.
    expect(codes('DELIVERED', ['orders.fulfill', 'finance.manage', 'returns.manage'])).toEqual([]);
    // No grants → no fast actions offered.
    expect(codes('PENDING', [])).toEqual([]);
    expect(fastActionsFrom(M, 'PENDING', undefined)).toEqual([]);
  });
});
