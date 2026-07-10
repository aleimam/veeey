import { describe, it, expect } from 'vitest';
import {
  isOutOfStock,
  isLastPiece,
  shortStockThreshold,
  isShortStock,
  average,
  isRunningFast,
  hasSpecialOrders,
  reorderTabs,
  suggestedReorderQty,
  expiryTabs,
  inExpiryHorizon,
  shortestExpiries,
  type ReorderInput,
} from './inventory-reorder';

const base: ReorderInput = {
  stock: 10,
  units30: 0,
  units90: 0,
  units180: 0,
  featured: false,
  weeklyBaseline: [0, 0, 0, 0, 0, 0],
  units7: 0,
  monthlyBaseline: [0, 0, 0, 0, 0, 0],
  preorderUnits: 0,
};

describe('stock-level tabs', () => {
  it('out of stock at 0 or below', () => {
    expect(isOutOfStock({ stock: 0 })).toBe(true);
    expect(isOutOfStock({ stock: -2 })).toBe(true);
    expect(isOutOfStock({ stock: 1 })).toBe(false);
  });
  it('last piece only at exactly 1', () => {
    expect(isLastPiece({ stock: 1 })).toBe(true);
    expect(isLastPiece({ stock: 0 })).toBe(false);
    expect(isLastPiece({ stock: 2 })).toBe(false);
  });
});

describe('short stock', () => {
  it('uses 90d for normal products, 180d for featured', () => {
    expect(shortStockThreshold({ units90: 30, units180: 70, featured: false })).toBe(30);
    expect(shortStockThreshold({ units90: 30, units180: 70, featured: true })).toBe(70);
  });
  it('is short when in stock but below the window', () => {
    expect(isShortStock({ stock: 20, units90: 30, units180: 70, featured: false })).toBe(true);
    expect(isShortStock({ stock: 40, units90: 30, units180: 70, featured: false })).toBe(false);
  });
  it('a featured product is short against 180d even if fine against 90d', () => {
    expect(isShortStock({ stock: 40, units90: 30, units180: 70, featured: true })).toBe(true);
  });
  it('out-of-stock is never "short stock" (belongs to its own tab)', () => {
    expect(isShortStock({ stock: 0, units90: 30, units180: 70, featured: false })).toBe(false);
  });
  it('no sales history → not short', () => {
    expect(isShortStock({ stock: 1, units90: 0, units180: 0, featured: false })).toBe(false);
  });
});

describe('average', () => {
  it('means a series and returns 0 for empty', () => {
    expect(average([2, 4, 6])).toBe(4);
    expect(average([])).toBe(0);
  });
});

describe('running fast', () => {
  it('flags a weekly spike ≥ 3× the 6-week baseline', () => {
    expect(isRunningFast({ units7: 12, weeklyBaseline: [4, 4, 4, 4, 4, 4], units30: 0, monthlyBaseline: [] })).toBe(true);
    expect(isRunningFast({ units7: 11, weeklyBaseline: [4, 4, 4, 4, 4, 4], units30: 0, monthlyBaseline: [] })).toBe(false);
  });
  it('flags a monthly spike ≥ 3× the 6-month baseline', () => {
    expect(isRunningFast({ units7: 0, weeklyBaseline: [], units30: 30, monthlyBaseline: [10, 10, 10, 10, 10, 10] })).toBe(true);
  });
  it('either horizon can trigger it', () => {
    expect(isRunningFast({ units7: 99, weeklyBaseline: [1, 1, 1, 1, 1, 1], units30: 0, monthlyBaseline: [50, 50] })).toBe(true);
  });
  it('a zero baseline never qualifies (avoids new-product noise)', () => {
    expect(isRunningFast({ units7: 20, weeklyBaseline: [0, 0, 0], units30: 20, monthlyBaseline: [0, 0] })).toBe(false);
  });
});

describe('special orders', () => {
  it('is driven by open pre-order demand', () => {
    expect(hasSpecialOrders({ preorderUnits: 3 })).toBe(true);
    expect(hasSpecialOrders({ preorderUnits: 0 })).toBe(false);
  });
});

describe('reorderTabs', () => {
  it('an out-of-stock item with open pre-orders lands on both tabs', () => {
    expect(reorderTabs({ ...base, stock: 0, preorderUnits: 5 })).toEqual(['out_of_stock', 'special_orders']);
  });
  it('a last piece that is also below its 90d sales is on both stock tabs', () => {
    expect(reorderTabs({ ...base, stock: 1, units90: 40 })).toEqual(['last_piece', 'short_stock']);
  });
  it('a healthy product qualifies for nothing', () => {
    expect(reorderTabs({ ...base, stock: 100, units90: 10, units180: 20 })).toEqual([]);
  });
  it('a spiking product shows on running_fast', () => {
    expect(reorderTabs({ ...base, stock: 100, units7: 30, weeklyBaseline: [2, 2, 2, 2, 2, 2] })).toEqual(['running_fast']);
  });
});

describe('suggestedReorderQty', () => {
  it('covers the 90d run-rate net of stock and incoming, floored at 1', () => {
    expect(suggestedReorderQty({ units90: 50, stock: 10 })).toBe(40);
    expect(suggestedReorderQty({ units90: 50, stock: 10, incoming: 15 })).toBe(25);
    expect(suggestedReorderQty({ units90: 5, stock: 100 })).toBe(1);
    expect(suggestedReorderQty({ units90: 0, stock: 0 })).toBe(1);
  });
});

describe('expiryTabs', () => {
  const now = new Date(Date.UTC(2026, 6, 10)); // 10 Jul 2026
  it('this-month item is also within all rolling windows (cumulative)', () => {
    expect(expiryTabs(new Date(Date.UTC(2026, 6, 20)), now)).toEqual(['this_month', 'quarter', 'bi_annual', 'year']);
  });
  it('next calendar month is a distinct bucket, still inside quarter', () => {
    expect(expiryTabs(new Date(Date.UTC(2026, 7, 5)), now)).toEqual(['next_month', 'quarter', 'bi_annual', 'year']);
  });
  it('inside 90 days but past next month → quarter only (plus wider)', () => {
    expect(expiryTabs(new Date(Date.UTC(2026, 9, 1)), now)).toEqual(['quarter', 'bi_annual', 'year']); // 1 Oct, ~83d
  });
  it('past the quarter but within 180 days → bi_annual', () => {
    expect(expiryTabs(new Date(Date.UTC(2026, 9, 20)), now)).toEqual(['bi_annual', 'year']); // 20 Oct, ~102d
  });
  it('within a year only', () => {
    expect(expiryTabs(new Date(Date.UTC(2027, 5, 1)), now)).toEqual(['year']); // 1 Jun 2027
  });
  it('already-expired lots match nothing', () => {
    expect(expiryTabs(new Date(Date.UTC(2026, 5, 30)), now)).toEqual([]);
  });
  it('beyond a year matches nothing', () => {
    expect(expiryTabs(new Date(Date.UTC(2028, 0, 1)), now)).toEqual([]);
  });
  it('month boundary lands in next_month, not this_month', () => {
    expect(expiryTabs(new Date(Date.UTC(2026, 7, 1)), now)).toEqual(['next_month', 'quarter', 'bi_annual', 'year']);
  });
});

describe('inExpiryHorizon', () => {
  const now = new Date(Date.UTC(2026, 6, 10));
  it('is true within a year, false when expired or beyond', () => {
    expect(inExpiryHorizon(new Date(Date.UTC(2026, 11, 1)), now)).toBe(true);
    expect(inExpiryHorizon(new Date(Date.UTC(2026, 0, 1)), now)).toBe(false);
    expect(inExpiryHorizon(new Date(Date.UTC(2030, 0, 1)), now)).toBe(false);
  });
});

describe('shortestExpiries', () => {
  it('returns the 3 nearest-expiry lots ascending', () => {
    const lots = [
      { lotId: 'c', expiry: new Date(Date.UTC(2026, 11, 1)) },
      { lotId: 'a', expiry: new Date(Date.UTC(2026, 7, 1)) },
      { lotId: 'd', expiry: new Date(Date.UTC(2027, 0, 1)) },
      { lotId: 'b', expiry: new Date(Date.UTC(2026, 9, 1)) },
    ];
    expect(shortestExpiries(lots, 3).map((l) => l.lotId)).toEqual(['a', 'b', 'c']);
  });
  it('does not mutate the input and returns fewer than N when short', () => {
    const lots = [{ lotId: 'x', expiry: new Date(Date.UTC(2026, 7, 1)) }];
    const out = shortestExpiries(lots, 3);
    expect(out).toHaveLength(1);
    expect(lots).toHaveLength(1);
  });
});
