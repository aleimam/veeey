import { describe, it, expect } from 'vitest';
import { resolveReportConfig } from './analytics-report';

describe('resolveReportConfig', () => {
  it('passes through valid keys', () => {
    expect(resolveReportConfig({ dimension: 'country', metric: 'pageviews', days: '90' })).toEqual({
      dimension: 'country',
      metric: 'pageviews',
      days: 90,
      filterDim: null,
      filterVal: '',
    });
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
