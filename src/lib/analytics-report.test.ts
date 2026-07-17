import { describe, it, expect } from 'vitest';
import { resolveReportConfig } from './analytics-report';

describe('resolveReportConfig', () => {
  it('passes through valid keys', () => {
    const c = resolveReportConfig({ dimension: 'country', metric: 'pageviews', days: '90' });
    expect(c).toMatchObject({
      dimension: 'country',
      metric: 'pageviews',
      days: 90,
      filterDim: null,
      filterVal: '',
    });
    // V5 F11: legacy ?days= maps onto the shared range contract (open-ended window).
    expect(c.range.preset).toBe('90d');
    expect(c.endAt).toBeUndefined();
  });

  it('resolves preset/from/to via the shared range contract (V5 F11)', () => {
    const c = resolveReportConfig({ preset: 'custom', from: '2026-07-01', to: '2026-07-10' });
    expect(c.range.preset).toBe('custom');
    expect(c.range.from).toBe('2026-07-01');
    expect(c.range.to).toBe('2026-07-10');
    expect(c.endAt).toBeInstanceOf(Date);
    expect(c.days).toBe(10); // inclusive day count
  });

  it('falls back to safe defaults for unknown/malicious keys (allow-list guard)', () => {
    const c = resolveReportConfig({ dimension: "x'; DROP TABLE", metric: 'nope', days: '365' });
    expect(c.dimension).toBe('device');
    expect(c.metric).toBe('sessions');
    expect(c.days).toBe(30);
  });

  it('keeps a filter only when the filter dimension is valid, and trims/caps the value', () => {
    expect(resolveReportConfig({ fdim: 'device', fval: '  mobile  ' })).toMatchObject({ filterDim: 'device', filterVal: 'mobile' });
    expect(resolveReportConfig({ fdim: 'evil', fval: 'x' })).toMatchObject({ filterDim: null, filterVal: '' });
    expect(resolveReportConfig({ fdim: 'country', fval: 'a'.repeat(500) }).filterVal.length).toBe(200);
  });
});
