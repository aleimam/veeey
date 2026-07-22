import { describe, expect, it } from 'vitest';
import { EMPTY_CART, qtyInCart, snapshotOf, type SnapshotLine } from './cart-snapshot';

const line = (over: Partial<SnapshotLine> = {}): SnapshotLine => ({
  productId: 'p1', slug: 'p1', name: 'Vitamin D', image: '/x.png',
  qty: 1, unitPricePiastres: 10_000, subtotalPiastres: 10_000,
  condition: 'NEW', preorder: false, ...over,
});

describe('snapshotOf', () => {
  it('counts UNITS, not lines — the header badge means items, not rows', () => {
    const cart = snapshotOf([line({ qty: 3, subtotalPiastres: 30_000 }), line({ productId: 'p2', qty: 2, subtotalPiastres: 20_000 })]);
    expect(cart.count).toBe(5);
    expect(cart.subtotalPiastres).toBe(50_000);
  });

  it('is empty-safe', () => {
    expect(snapshotOf([])).toEqual({ lines: [], count: 0, subtotalPiastres: 0 });
    expect(EMPTY_CART.count).toBe(0);
  });
});

describe('qtyInCart — which line a button owns', () => {
  it('finds the plain NEW line by default', () => {
    expect(qtyInCart(snapshotOf([line({ qty: 2 })]), 'p1')).toBe(2);
  });

  it('returns 0 for a product that is not in the cart', () => {
    expect(qtyInCart(snapshotOf([line()]), 'other')).toBe(0);
  });

  it('keeps condition variants apart', () => {
    // Same product, two prices, two cart lines. The PDP stepper must move the
    // variant the shopper selected — moving the other silently changes what
    // they are buying, and what they pay.
    const cart = snapshotOf([line({ qty: 2 }), line({ qty: 5, condition: 'OPEN_BOX' })]);
    expect(qtyInCart(cart, 'p1')).toBe(2);
    expect(qtyInCart(cart, 'p1', { condition: 'OPEN_BOX' })).toBe(5);
  });

  it('does not let a PRE-ORDER line make the in-stock button read "already added"', () => {
    // A pre-order holds no stock and is charged a deposit — a different thing
    // entirely from the in-stock line, even for the same product.
    const cart = snapshotOf([line({ qty: 4, preorder: true })]);
    expect(qtyInCart(cart, 'p1')).toBe(0);
    expect(qtyInCart(cart, 'p1', { preorder: true })).toBe(4);
  });

  it('sums duplicate lines of the same product and condition', () => {
    expect(qtyInCart(snapshotOf([line({ qty: 1 }), line({ qty: 2 })]), 'p1')).toBe(3);
  });
});
