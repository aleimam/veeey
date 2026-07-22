import { describe, expect, it } from 'vitest';
import { appliesAfterCutover, directionForWpStatus, linesToIngestDeltas, netUnits, normalizeWpStatus, planFefoTake } from './ingest-logic';

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

describe('appliesAfterCutover — the flip boundary', () => {
  const cut = new Date('2026-07-22T12:00:00Z');
  const before = new Date('2026-07-22T09:00:00Z');
  const after = new Date('2026-07-22T15:00:00Z');

  it('with no cutover configured, everything applies', () => {
    expect(appliesAfterCutover('SALE', before, before, null)).toBe(true);
    expect(appliesAfterCutover('RESTORE', before, before, null)).toBe(true);
  });

  it('a SALE is judged on when it was PLACED — Woo reserved the stock then', () => {
    // Placed before the flip, touched after: already inside the snapshot we
    // imported. Applying it would subtract the same unit twice.
    expect(appliesAfterCutover('SALE', before, after, cut)).toBe(false);
    expect(appliesAfterCutover('SALE', after, after, cut)).toBe(true);
  });

  it('a RESTORE is judged on when it CHANGED — the put-back happens then', () => {
    // Sold before the flip (baked in), cancelled after → a real, unbooked gain.
    expect(appliesAfterCutover('RESTORE', before, after, cut)).toBe(true);
    // Sold and cancelled entirely before the flip → both sides already netted.
    expect(appliesAfterCutover('RESTORE', before, before, cut)).toBe(false);
  });

  it('does not apply a movement it cannot place either side of the line', () => {
    expect(appliesAfterCutover('SALE', null, after, cut)).toBe(false);
    expect(appliesAfterCutover('RESTORE', after, undefined, cut)).toBe(false);
    expect(appliesAfterCutover('SALE', new Date('nope'), after, cut)).toBe(false);
  });

  it('is exclusive at the boundary — the snapshot instant belongs to the snapshot', () => {
    expect(appliesAfterCutover('SALE', cut, cut, cut)).toBe(false);
  });
});

describe('planFefoTake', () => {
  it('takes from the soonest expiry first (lots arrive pre-sorted)', () => {
    const p = planFefoTake([{ id: 'a', qtyOnHand: 2 }, { id: 'b', qtyOnHand: 10 }], 5);
    expect(p.takes).toEqual([{ lotId: 'a', qty: 2 }, { lotId: 'b', qty: 3 }]);
    expect(p.shortfall).toBe(0);
  });

  it('stops as soon as it is satisfied', () => {
    const p = planFefoTake([{ id: 'a', qtyOnHand: 9 }, { id: 'b', qtyOnHand: 9 }], 4);
    expect(p.takes).toEqual([{ lotId: 'a', qty: 4 }]);
  });

  it('REPORTS a shortfall instead of refusing — ev.net already gave the goods away', () => {
    const p = planFefoTake([{ id: 'a', qtyOnHand: 1 }], 4);
    expect(p.takes).toEqual([{ lotId: 'a', qty: 1 }]);
    expect(p.shortfall).toBe(3);
  });

  it('handles no stock at all, and skips empty/negative lots', () => {
    expect(planFefoTake([], 3)).toEqual({ takes: [], shortfall: 3 });
    expect(planFefoTake([{ id: 'a', qtyOnHand: 0 }, { id: 'b', qtyOnHand: -5 }, { id: 'c', qtyOnHand: 2 }], 2).takes)
      .toEqual([{ lotId: 'c', qty: 2 }]);
  });

  it('is a no-op for a non-positive quantity', () => {
    expect(planFefoTake([{ id: 'a', qtyOnHand: 5 }], 0)).toEqual({ takes: [], shortfall: 0 });
  });
});
