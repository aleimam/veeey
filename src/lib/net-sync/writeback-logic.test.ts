import { describe, it, expect } from 'vitest';
import { writebackAction, linesToDeltas, writebackOp, MAX_DELTA_PER_ROW } from './writeback-logic';

describe('writebackAction (confirm-triggered · restore on cancel)', () => {
  it('SALE on first entry into the committed set', () => {
    expect(writebackAction('PENDING', 'CONFIRMED')).toBe('SALE');
    expect(writebackAction('HOLD', 'CONFIRMED')).toBe('SALE');
    // staff jump straight to SHIPPED/DELIVERED still counts as the sale entry
    expect(writebackAction('PENDING', 'SHIPPED')).toBe('SALE');
    expect(writebackAction('EDIT', 'DELIVERED')).toBe('SALE');
  });

  it('no action for pre-confirm shuffling or moves within the committed set', () => {
    expect(writebackAction('PENDING', 'HOLD')).toBeNull();
    expect(writebackAction('PENDING', 'EDIT')).toBeNull();
    expect(writebackAction('CONFIRMED', 'SHIPPED')).toBeNull(); // already sold
    expect(writebackAction('SHIPPED', 'DELIVERED')).toBeNull();
  });

  it('RESTORE only when a committed order is cancelled/refunded', () => {
    expect(writebackAction('CONFIRMED', 'CANCELLED')).toBe('RESTORE');
    expect(writebackAction('SHIPPED', 'CANCELLED')).toBe('RESTORE');
    expect(writebackAction('DELIVERED', 'REFUNDED')).toBe('RESTORE');
    // cancelling a never-confirmed order never touched WP → nothing to restore
    expect(writebackAction('PENDING', 'CANCELLED')).toBeNull();
    expect(writebackAction('HOLD', 'CANCELLED')).toBeNull();
  });
});

describe('linesToDeltas', () => {
  it('groups duplicate lines per WP product and skips non-WP products', () => {
    expect(linesToDeltas([
      { wpId: 111, qty: 2 },
      { wpId: 111, qty: 1 },
      { wpId: 222, qty: 3 },
      { wpId: null, qty: 5 }, // veeey.net-only product — nothing to write to WP
    ])).toEqual([{ wpId: 111, qty: 3 }, { wpId: 222, qty: 3 }]);
  });

  it('drops zero/negative qty and refuses absurd deltas (sanity cap)', () => {
    expect(linesToDeltas([{ wpId: 111, qty: 0 }, { wpId: 222, qty: -2 }])).toEqual([]);
    expect(linesToDeltas([{ wpId: 111, qty: MAX_DELTA_PER_ROW + 1 }])).toEqual([]);
    expect(linesToDeltas([{ wpId: 111, qty: MAX_DELTA_PER_ROW }])).toEqual([{ wpId: 111, qty: MAX_DELTA_PER_ROW }]);
  });
});

describe('writebackOp — which way a row moves ev.net stock', () => {
  it('a sale here decreases stock there', () => {
    expect(writebackOp('SALE')).toBe('decrease');
  });

  it('a cancel and a stock-in both increase it', () => {
    expect(writebackOp('RESTORE')).toBe('increase');
    // Goods received via an Incoming Shipment — ev.net must be able to sell
    // them too, or the two storefronts disagree about what is on the shelf.
    expect(writebackOp('STOCK_IN')).toBe('increase');
  });

  it('REFUSES an unrecognised direction instead of defaulting to increase', () => {
    // These rows drive a live storefront's inventory. A typo or a half-deployed
    // rename must not silently add stock.
    expect(writebackOp('STOCKIN')).toBeNull();
    expect(writebackOp('sale')).toBeNull();
    expect(writebackOp('')).toBeNull();
  });
});
