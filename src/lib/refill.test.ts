import { describe, it, expect } from 'vitest';
import { parseFrequencies, advanceNextRun, noticeDue, refillDiscount, parseRefillAddress } from './refill';

describe('parseFrequencies', () => {
  it('parses, bounds (7–180), dedupes and sorts', () => {
    expect(parseFrequencies('30,45,60,90')).toEqual([30, 45, 60, 90]);
    expect(parseFrequencies('90, 30, 30, 5, 999, x')).toEqual([30, 90]);
    expect(parseFrequencies('')).toEqual([30, 45, 60, 90]); // fallback
    expect(parseFrequencies(null)).toEqual([30, 45, 60, 90]);
  });
});

describe('advanceNextRun', () => {
  const day = 86_400_000;
  it('advances one cycle normally', () => {
    const next = advanceNextRun(new Date('2026-07-13T07:00:00Z'), 30, new Date('2026-07-13T08:00:00Z'));
    expect(next.toISOString()).toBe('2026-08-12T07:00:00.000Z');
  });
  it('catches up past long gaps in one hop (no order burst after a pause)', () => {
    const start = new Date('2026-01-01T07:00:00Z');
    const now = new Date(start.getTime() + 95 * day); // ~3 missed 30-day cycles
    const next = advanceNextRun(start, 30, now);
    expect(next.getTime()).toBeGreaterThan(now.getTime());
    expect(next.getTime() - now.getTime()).toBeLessThanOrEqual(30 * day);
  });
});

describe('noticeDue', () => {
  const nextRunAt = new Date('2026-07-20T07:00:00Z');
  it('is due within the lead window when this run was not yet noticed', () => {
    expect(noticeDue({ nextRunAt, noticedRunAt: null }, new Date('2026-07-18T07:00:00Z'), 3)).toBe(true);
    expect(noticeDue({ nextRunAt, noticedRunAt: null }, new Date('2026-07-10T07:00:00Z'), 3)).toBe(false); // too early
  });
  it('is not re-sent for the same run, but fires again for the next run', () => {
    expect(noticeDue({ nextRunAt, noticedRunAt: nextRunAt }, new Date('2026-07-19T07:00:00Z'), 3)).toBe(false);
    const later = new Date('2026-08-19T07:00:00Z');
    expect(noticeDue({ nextRunAt: later, noticedRunAt: nextRunAt }, new Date('2026-08-17T07:00:00Z'), 3)).toBe(true);
  });
});

describe('refillDiscount', () => {
  it('computes integer piastres and clamps the percent', () => {
    expect(refillDiscount(10000n, 15)).toBe(1500n);
    expect(refillDiscount(999n, 15)).toBe(149n); // floors
    expect(refillDiscount(10000n, -5)).toBe(0n);
    expect(refillDiscount(10000n, 200)).toBe(9000n); // clamped to 90
  });
});

describe('parseRefillAddress', () => {
  it('requires name/phone/governorate/city/street (area optional)', () => {
    const ok = parseRefillAddress({ name: 'A', phone: '01000000000', governorate: 'Cairo', city: 'Nasr', area: '', street: '1 St' });
    expect(ok?.street).toBe('1 St');
    expect(parseRefillAddress({ name: 'A', phone: '', governorate: 'Cairo', city: 'Nasr', street: '1 St' })).toBeNull();
    expect(parseRefillAddress(null)).toBeNull();
  });
});
