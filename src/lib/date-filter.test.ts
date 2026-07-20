import { describe, it, expect } from 'vitest';
import { dayRangeFilter } from './date-filter';

describe('dayRangeFilter (Codex audit P1: list vs CSV export disagreed on `to`)', () => {
  it('covers the WHOLE `to` day via an exclusive next-day bound', () => {
    const f = dayRangeFilter('2026-07-01', '2026-07-20')!;
    expect(f.gte).toEqual(new Date('2026-07-01T00:00:00'));
    // The old export used `lte: new Date('2026-07-20')` = midnight, which
    // excluded ~the entire day. The bound must land on the 21st.
    expect(f.lt).toEqual(new Date(2026, 6, 21));
  });

  it('includes an order timestamped late on the `to` day', () => {
    const f = dayRangeFilter(undefined, '2026-07-20')!;
    const lateOrder = new Date('2026-07-20T23:59:59.500');
    expect(lateOrder < f.lt!).toBe(true);
    // …and excludes the next day
    expect(new Date('2026-07-21T00:00:00') < f.lt!).toBe(false);
  });

  it('handles a single-day range (from === to)', () => {
    const f = dayRangeFilter('2026-07-20', '2026-07-20')!;
    expect(new Date('2026-07-20T12:00:00') >= f.gte!).toBe(true);
    expect(new Date('2026-07-20T12:00:00') < f.lt!).toBe(true);
  });

  it('supports open-ended ranges and returns undefined when unusable', () => {
    expect(dayRangeFilter('2026-07-01', undefined)).toEqual({ gte: new Date('2026-07-01T00:00:00') });
    expect(dayRangeFilter(undefined, undefined)).toBeUndefined();
    expect(dayRangeFilter('', '')).toBeUndefined();
    expect(dayRangeFilter('not-a-date', undefined)).toBeUndefined();
  });
});
