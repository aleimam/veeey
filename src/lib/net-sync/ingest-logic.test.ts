import { describe, expect, it } from 'vitest';
import { directionForWpStatus, linesToIngestDeltas, netUnits, normalizeWpStatus } from './ingest-logic';

describe('directionForWpStatus', () => {
  it('treats the shipped/paid statuses as a sale', () => {
    for (const s of ['processing', 'completed', 'shipped', 'cash-delivered', 'card-delivered']) {
      expect(directionForWpStatus(s)).toBe('SALE');
    }
  });

  it('counts on-hold as SOLD — Woo reserves stock at placement, not at shipping', () => {
    // Treating it as "not yet sold" would let veeey.net resell a unit ev.net has
    // already set aside for someone.
    expect(directionForWpStatus('on-hold')).toBe('SALE');
  });

  it('puts units back when the sale comes undone', () => {
    for (const s of ['cancelled', 'refunded', 'failed']) expect(directionForWpStatus(s)).toBe('RESTORE');
  });

  it('says nothing for statuses that carry no commitment', () => {
    for (const s of ['pending', 'checkout-draft', '', null, undefined]) expect(directionForWpStatus(s)).toBeNull();
  });

  it('tolerates the wc- prefix and casing that WP actually emits', () => {
    expect(normalizeWpStatus('WC-Processing')).toBe('processing');
    expect(directionForWpStatus('wc-completed')).toBe('SALE');
    expect(directionForWpStatus('  wc-Cancelled ')).toBe('RESTORE');
  });
});

describe('linesToIngestDeltas', () => {
  it('sums repeated products into one delta, sorted for comparability', () => {
    expect(linesToIngestDeltas([{ wpId: 20, qty: 1 }, { wpId: 10, qty: 2 }, { wpId: 20, qty: 3 }]))
      .toEqual([{ wpId: 10, qty: 2 }, { wpId: 20, qty: 4 }]);
  });

  it('drops lines we cannot attribute to a product', () => {
    // An unattributable delta is worse than none — it silently skews the
    // reconciliation the whole cutover gate depends on.
    expect(linesToIngestDeltas([{ wpId: null, qty: 5 }, { wpId: 7, qty: 0 }, { wpId: 7, qty: -2 }])).toEqual([]);
  });

  it('floors fractional quantities', () => {
    expect(linesToIngestDeltas([{ wpId: 3, qty: 2.9 }])).toEqual([{ wpId: 3, qty: 2 }]);
  });
});

describe('netUnits', () => {
  it('nets sales against restores per product', () => {
    const n = netUnits([
      { wpId: 1, qty: 3, direction: 'SALE' },
      { wpId: 1, qty: 1, direction: 'RESTORE' },
      { wpId: 2, qty: 5, direction: 'SALE' },
    ]);
    expect(n.get(1)).toBe(-2); // ev.net consumed 2 net
    expect(n.get(2)).toBe(-5);
  });

  it('ignores rows with an unknown direction rather than assuming a sale', () => {
    expect(netUnits([{ wpId: 1, qty: 4, direction: 'WHATEVER' }]).size).toBe(0);
  });
});
