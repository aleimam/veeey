import { describe, it, expect } from 'vitest';
import { resolveAnalyticsRange, ymd } from './analytics-range';

const NOW = new Date('2026-07-17T12:00:00');

describe('resolveAnalyticsRange (V5 audit F9/F10/F11)', () => {
  it('resolves presets to day windows anchored at now', () => {
    expect(resolveAnalyticsRange({ preset: '7d' }, { now: NOW })).toMatchObject({ preset: '7d', days: 7, endAt: undefined });
    expect(resolveAnalyticsRange({ preset: '90d' }, { now: NOW })).toMatchObject({ preset: '90d', days: 90 });
  });

  it('mtd spans from the 1st through now', () => {
    const r = resolveAnalyticsRange({ preset: 'mtd' }, { now: NOW });
    expect(r.preset).toBe('mtd');
    expect(r.days).toBe(17); // Jul 1 → Jul 17 noon rounds up to 17 days
  });

  it('legacy ?days= links still resolve (old dashboard URLs)', () => {
    expect(resolveAnalyticsRange({ days: '7' }, { now: NOW }).preset).toBe('7d');
    expect(resolveAnalyticsRange({ days: '90' }, { now: NOW }).days).toBe(90);
  });

  it('falls back to the page default preset', () => {
    expect(resolveAnalyticsRange({}, { now: NOW, defaultPreset: 'mtd' }).preset).toBe('mtd');
    expect(resolveAnalyticsRange({}, { now: NOW }).preset).toBe('30d');
  });

  it('custom from/to sets an inclusive end-of-day anchor + exact day span', () => {
    const r = resolveAnalyticsRange({ from: '2026-05-01', to: '2026-05-31' }, { now: NOW });
    expect(r.preset).toBe('custom');
    expect(r.days).toBe(31);
    expect(r.from).toBe('2026-05-01');
    expect(ymd(r.endAt!)).toBe('2026-05-31');
    expect(r.endAt!.getHours()).toBe(23); // end of day, inclusive
  });

  it('AUTO-SWAPS inverted ranges instead of returning zeros (F9)', () => {
    const r = resolveAnalyticsRange({ from: '2026-05-31', to: '2026-05-01' }, { now: NOW });
    expect(r.swapped).toBe(true);
    expect(r.from).toBe('2026-05-01');
    expect(r.to).toBe('2026-05-31');
  });

  it('ignores malformed dates', () => {
    const r = resolveAnalyticsRange({ from: 'garbage', to: '2026-05-31', preset: '7d' }, { now: NOW });
    expect(r.preset).toBe('7d');
    expect(r.from).toBeNull();
  });
});
