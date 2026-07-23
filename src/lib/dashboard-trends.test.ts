import { describe, it, expect } from 'vitest';
import { trendBuckets, trendSince, bucketize } from './dashboard-trends';

// Fixed "now": Fri 2026-07-23, mid-morning local.
const NOW = new Date(2026, 6, 23, 10, 30);

describe('trendBuckets', () => {
  it('days: 7 daily buckets ending today', () => {
    const b = trendBuckets('days', NOW);
    expect(b).toHaveLength(7);
    expect(b[6].label).toBe('23/7');
    expect(b[0].label).toBe('17/7');
    // newest bucket ends at start of tomorrow and contains "now"
    expect(b[6].end.getTime()).toBe(new Date(2026, 6, 24).getTime());
    expect(NOW.getTime()).toBeGreaterThanOrEqual(b[6].start.getTime());
    expect(NOW.getTime()).toBeLessThan(b[6].end.getTime());
    // contiguous, non-overlapping
    for (let i = 1; i < b.length; i++) expect(b[i].start.getTime()).toBe(b[i - 1].end.getTime());
  });

  it('weeks: 7 weekly buckets, latest includes today', () => {
    const b = trendBuckets('weeks', NOW);
    expect(b).toHaveLength(7);
    expect(b[6].end.getTime()).toBe(new Date(2026, 6, 24).getTime());
    // each bucket spans exactly 7 days
    for (const w of b) expect((w.end.getTime() - w.start.getTime()) / 86400000).toBe(7);
    // oldest start is 48 days before today
    expect(b[0].start.getTime()).toBe(new Date(2026, 6, 23 - 48).getTime());
    for (let i = 1; i < b.length; i++) expect(b[i].start.getTime()).toBe(b[i - 1].end.getTime());
  });

  it('months: 7 calendar months, current last', () => {
    const b = trendBuckets('months', NOW, 'en');
    expect(b).toHaveLength(7);
    expect(b[6].label).toBe('Jul');
    expect(b[0].label).toBe('Jan');
    expect(b[6].start.getTime()).toBe(new Date(2026, 6, 1).getTime());
    expect(b[6].end.getTime()).toBe(new Date(2026, 7, 1).getTime());
    // spans the year boundary cleanly
    const dec = trendBuckets('months', new Date(2026, 1, 15));
    expect(dec[0].label).toBe('Aug');
    expect(dec.map((m) => m.label)).toEqual(['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb']);
  });

  it('months: Arabic labels', () => {
    const b = trendBuckets('months', NOW, 'ar');
    expect(b[6].label).toBe('يوليو');
  });
});

describe('trendSince', () => {
  it('reaches back to the first of the month 6 months ago', () => {
    expect(trendSince(NOW).getTime()).toBe(new Date(2026, 0, 1).getTime());
  });
});

describe('bucketize', () => {
  it('sums rows into the right day bucket and ignores out-of-range', () => {
    const b = trendBuckets('days', NOW);
    const rows = [
      { at: new Date(2026, 6, 23, 9), v: 100 }, // today
      { at: new Date(2026, 6, 23, 20), v: 50 }, // today
      { at: new Date(2026, 6, 17, 1), v: 7 }, // oldest bucket
      { at: new Date(2026, 6, 10), v: 999 }, // before range → ignored
    ];
    const totals = bucketize(rows, (r) => r.at, (r) => r.v, b);
    expect(totals[6]).toBe(150);
    expect(totals[0]).toBe(7);
    expect(totals.reduce((s, n) => s + n, 0)).toBe(157);
  });

  it('a row on the exact bucket boundary lands in the newer bucket (half-open)', () => {
    const b = trendBuckets('days', NOW);
    // midnight starting today = start of bucket[6], end of bucket[5]
    const totals = bucketize([{ at: new Date(2026, 6, 23), v: 5 }], (r) => r.at, (r) => r.v, b);
    expect(totals[6]).toBe(5);
    expect(totals[5]).toBe(0);
  });
});
