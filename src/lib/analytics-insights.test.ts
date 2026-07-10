import { describe, it, expect } from 'vitest';
import { pct, bounceRate, abandonmentRate, fillDailySeries, topBuckets } from './analytics';

describe('pct', () => {
  it('clamps to 0..1 and handles zero/empty wholes', () => {
    expect(pct(1, 4)).toBe(0.25);
    expect(pct(5, 4)).toBe(1); // clamped
    expect(pct(3, 0)).toBe(0);
    expect(pct(-1, 4)).toBe(0);
  });
});

describe('abandonmentRate', () => {
  it('is 1 - converted/carts', () => {
    expect(abandonmentRate(100, 40)).toBeCloseTo(0.6);
    expect(abandonmentRate(0, 0)).toBe(0); // no carts → nothing abandoned
    expect(abandonmentRate(10, 10)).toBe(0);
  });
});

describe('bounceRate', () => {
  it('is single-page / visitors', () => {
    expect(bounceRate(30, 100)).toBe(0.3);
    expect(bounceRate(0, 0)).toBe(0);
  });
});

describe('fillDailySeries', () => {
  const end = Date.UTC(2026, 6, 10); // 2026-07-10 UTC
  it('produces a contiguous run of `days` days ending on endMs', () => {
    const series = fillDailySeries(end, 3, new Map(), { visitors: 0 });
    expect(series.map((s) => s.date)).toEqual(['2026-07-08', '2026-07-09', '2026-07-10']);
    expect(series.every((s) => s.visitors === 0)).toBe(true);
  });
  it('merges present days and zero-fills the gaps', () => {
    const byDate = new Map([['2026-07-09', { visitors: 42 }]]);
    const series = fillDailySeries(end, 3, byDate, { visitors: 0 });
    expect(series.find((s) => s.date === '2026-07-09')?.visitors).toBe(42);
    expect(series.find((s) => s.date === '2026-07-08')?.visitors).toBe(0);
  });
});

describe('topBuckets', () => {
  it('merges nulls into Unknown, sorts desc, limits, and computes share', () => {
    const rows = [
      { key: 'mobile', count: 60 },
      { key: 'desktop', count: 30 },
      { key: null, count: 10 },
    ];
    const b = topBuckets(rows, { limit: 2 });
    expect(b).toHaveLength(2);
    expect(b[0]).toMatchObject({ key: 'mobile', count: 60 });
    expect(b[0].share).toBeCloseTo(0.6);
    expect(b[1].key).toBe('desktop');
  });
  it('labels empty/null keys with the unknownLabel', () => {
    const b = topBuckets([{ key: '', count: 5 }], { unknownLabel: 'N/A' });
    expect(b[0].key).toBe('N/A');
  });
});
