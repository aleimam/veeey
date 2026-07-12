import { describe, it, expect } from 'vitest';
import { normalizeTrustpilot, defaultTrustpilotConfig, tpConfigured, tpShows, TP_TEMPLATES } from './trustpilot-config';

describe('normalizeTrustpilot', () => {
  it('returns inert defaults for empty input', () => {
    const c = normalizeTrustpilot(null);
    expect(c.businessUnitId).toBe('');
    expect(tpConfigured(c)).toBe(false);
    expect(c.home.template).toBe(defaultTrustpilotConfig().home.template);
  });

  it('strips protocol/trailing slash from the domain and trims ids', () => {
    const c = normalizeTrustpilot({ businessUnitId: '  abc123  ', domain: 'https://veeey.com/' });
    expect(c.businessUnitId).toBe('abc123');
    expect(c.domain).toBe('veeey.com');
    expect(tpConfigured(c)).toBe(true);
  });

  it('rejects unknown template ids (falls back to the placement default)', () => {
    const c = normalizeTrustpilot({ home: { template: 'not-a-real-template', height: 999 } });
    expect(TP_TEMPLATES.some((t) => t.id === c.home.template)).toBe(true);
    expect(c.home.height).toBe(999);
  });

  it('treats missing enabled as true and invalid height as the default', () => {
    const c = normalizeTrustpilot({ footer: { height: -5 } });
    expect(c.footer.enabled).toBe(true);
    expect(c.footer.height).toBe(defaultTrustpilotConfig().footer.height);
  });
});

describe('tpShows', () => {
  it('is false unless configured AND the placement is enabled', () => {
    const off = normalizeTrustpilot({ businessUnitId: '', home: { enabled: true } });
    expect(tpShows(off, 'home')).toBe(false); // not configured
    const on = normalizeTrustpilot({ businessUnitId: 'x', home: { enabled: true }, footer: { enabled: false } });
    expect(tpShows(on, 'home')).toBe(true);
    expect(tpShows(on, 'footer')).toBe(false);
  });
});
