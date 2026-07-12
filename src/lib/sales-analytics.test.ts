import { describe, expect, it } from 'vitest';
import { periodRange, bucketByValue } from '@/lib/sales-analytics-core';

describe('periodRange', () => {
  const now = new Date('2026-07-12T10:00:00.000Z');

  it('MTD compares to the same elapsed span of the previous month', () => {
    const r = periodRange('mtd', undefined, undefined, now);
    expect(r.start.getFullYear()).toBe(2026);
    expect(r.start.getMonth()).toBe(6); // July (0-indexed)
    expect(r.start.getDate()).toBe(1);
    expect(r.prevStart.getMonth()).toBe(5); // June
    expect(r.prevStart.getDate()).toBe(1);
    // previous window spans the same elapsed time as MTD
    expect(r.end.getTime() - r.start.getTime()).toBe(r.prevEnd.getTime() - r.prevStart.getTime());
  });

  it('rolling windows put the previous window immediately before', () => {
    const r = periodRange('30d', undefined, undefined, now);
    expect(Math.round((r.end.getTime() - r.start.getTime()) / 86_400_000)).toBe(30);
    expect(r.prevEnd.getTime()).toBe(r.start.getTime());
    expect(Math.round((r.prevEnd.getTime() - r.prevStart.getTime()) / 86_400_000)).toBe(30);
  });

  it('custom range mirrors length into the previous window', () => {
    const r = periodRange('custom', '2026-07-01', '2026-07-10', now);
    expect(r.start.getFullYear()).toBe(2026);
    expect(r.prevEnd.getTime()).toBeLessThan(r.start.getTime());
  });
});

describe('bucketByValue', () => {
  it('assigns each total to its band (piastres)', () => {
    // EGP 300, 700, 1500, 4000, 9000 → bands 0–500 / 500–1000 / 1000–2000 / 3000–5000 / 5000+
    const b = bucketByValue([30000, 70000, 150000, 400000, 900000]);
    const byLabel = Object.fromEntries(b.map((x) => [x.label, x.count]));
    expect(byLabel['0–500']).toBe(1);
    expect(byLabel['500–1000']).toBe(1);
    expect(byLabel['1000–2000']).toBe(1);
    expect(byLabel['3000–5000']).toBe(1);
    expect(byLabel['5000+']).toBe(1);
  });

  it('handles an empty set', () => {
    expect(bucketByValue([]).every((b) => b.count === 0)).toBe(true);
  });
});
