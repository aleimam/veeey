import { describe, it, expect } from 'vitest';
import {
  isRequestType, isRequestStatus, requiresCustomer, allowsPhotos, requestEditable,
  validateRequest, expectedDepositPiastres, requestUid, REQUEST_TYPES, reorderTabToRequestType, pickOrderRequestLines,
} from './request-logic';

describe('request type + status guards', () => {
  it('recognises exactly the four types', () => {
    expect(REQUEST_TYPES).toEqual(['SPECIAL_ORDER', 'OUT_OF_STOCK', 'RESTOCK', 'OPTIONAL']);
    for (const t of REQUEST_TYPES) expect(isRequestType(t)).toBe(true);
    expect(isRequestType('BAD')).toBe(false);
    expect(isRequestType(3)).toBe(false);
  });

  it('recognises the approval-gate statuses', () => {
    ['PENDING', 'APPROVED', 'REJECTED'].forEach((s) => expect(isRequestStatus(s)).toBe(true));
    expect(isRequestStatus('SENT')).toBe(false);
  });
});

describe('type behaviours', () => {
  it('only special orders need a customer / allow photos', () => {
    expect(requiresCustomer('SPECIAL_ORDER')).toBe(true);
    expect(requiresCustomer('RESTOCK')).toBe(false);
    expect(allowsPhotos('SPECIAL_ORDER')).toBe(true);
    expect(allowsPhotos('OPTIONAL')).toBe(false);
  });

  it('lines are editable only while PENDING', () => {
    expect(requestEditable('PENDING')).toBe(true);
    expect(requestEditable('APPROVED')).toBe(false);
    expect(requestEditable('REJECTED')).toBe(false);
  });
});

describe('validateRequest', () => {
  const line = [{ productId: 'p1', count: 2 }];

  it('rejects an unknown type', () => {
    expect(validateRequest({ type: 'BAD', lines: line })).toHaveProperty('type');
  });

  it('requires at least one valid line', () => {
    expect(validateRequest({ type: 'RESTOCK', lines: [] })).toHaveProperty('lines');
    expect(validateRequest({ type: 'RESTOCK', lines: [{ productId: 'p1', count: 0 }] })).toHaveProperty('lines');
  });

  it('a restock with a line is valid', () => {
    expect(validateRequest({ type: 'RESTOCK', lines: line })).toEqual({});
  });

  it('a special order needs a customer (existing id OR a new name)', () => {
    expect(validateRequest({ type: 'SPECIAL_ORDER', lines: line })).toHaveProperty('customer');
    expect(validateRequest({ type: 'SPECIAL_ORDER', customerId: 'c1', lines: line })).toEqual({});
    expect(validateRequest({ type: 'SPECIAL_ORDER', newCustomerName: 'Ada', lines: line })).toEqual({});
  });
});

describe('expectedDepositPiastres', () => {
  it('takes the percentage of the total selling value', () => {
    // 2 × 100.00 EGP + 1 × 50.00 EGP = 250.00 EGP = 25000 piastres; 25% → 6250.
    const lines = [{ count: 2, sellingPricePiastres: 10000 }, { count: 1, sellingPricePiastres: 5000 }];
    expect(expectedDepositPiastres(25, lines)).toBe(6250);
  });

  it('treats a missing price as zero and a zero percent as zero', () => {
    expect(expectedDepositPiastres(25, [{ count: 3, sellingPricePiastres: null }])).toBe(0);
    expect(expectedDepositPiastres(0, [{ count: 1, sellingPricePiastres: 10000 }])).toBe(0);
  });
});

describe('reorderTabToRequestType', () => {
  it('maps stock-shortage tabs to OUT_OF_STOCK and demand tabs to RESTOCK', () => {
    expect(reorderTabToRequestType('out_of_stock')).toBe('OUT_OF_STOCK');
    expect(reorderTabToRequestType('last_piece')).toBe('OUT_OF_STOCK');
    expect(reorderTabToRequestType('short_stock')).toBe('RESTOCK');
    expect(reorderTabToRequestType('running_fast')).toBe('RESTOCK');
  });

  it('maps the special-orders suggestion tab to a purchasing top-up (no customer here)', () => {
    // A customer-linked SPECIAL_ORDER is placed from the order flow, not the tab.
    expect(reorderTabToRequestType('special_orders')).toBe('OUT_OF_STOCK');
  });

  it('defaults unknown tabs to OUT_OF_STOCK and always returns a valid type', () => {
    expect(reorderTabToRequestType('mystery')).toBe('OUT_OF_STOCK');
    expect(isRequestType(reorderTabToRequestType('ignored'))).toBe(true);
  });
});

describe('pickOrderRequestLines', () => {
  const mk = (id: string, preorder: boolean) => ({ id, preorder });

  it('returns only the pre-ordered lines when any are flagged', () => {
    const items = [mk('a', false), mk('b', true), mk('c', true)];
    expect(pickOrderRequestLines(items).map((i) => i.id)).toEqual(['b', 'c']);
  });

  it('falls back to every line when none are pre-ordered', () => {
    const items = [mk('a', false), mk('b', false)];
    expect(pickOrderRequestLines(items).map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('returns empty for an empty order', () => {
    expect(pickOrderRequestLines([])).toEqual([]);
  });
});

describe('requestUid', () => {
  it('formats REQ<YY><MM><seq3>, sharing the key shape with YeldnIN', () => {
    expect(requestUid(new Date(2026, 6, 1), 14)).toBe('REQ2607014');
    expect(requestUid(new Date(2026, 11, 1), 1)).toBe('REQ2612001');
  });
});
