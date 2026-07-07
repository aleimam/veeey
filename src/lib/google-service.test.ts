import { describe, it, expect } from 'vitest';
import { sanitizeGoogleConfig } from './google-config';

describe('sanitizeGoogleConfig', () => {
  it('trims and upper-cases GA4 / GTM / Ads ids', () => {
    const c = sanitizeGoogleConfig({ ga4Id: ' g-abc123 ', gtmId: 'gtm-xyz', adsId: 'aw-999' });
    expect(c.ga4Id).toBe('G-ABC123');
    expect(c.gtmId).toBe('GTM-XYZ');
    expect(c.adsId).toBe('AW-999');
  });

  it('extracts the verification token from a pasted <meta> tag or accepts a raw token', () => {
    expect(sanitizeGoogleConfig({ searchConsole: '<meta name="google-site-verification" content="AbC_123" />' }).searchConsole).toBe('AbC_123');
    expect(sanitizeGoogleConfig({ searchConsole: 'AbC_123' }).searchConsole).toBe('AbC_123');
  });

  it('leaves unknown-shaped ids as trimmed text and empty as empty', () => {
    expect(sanitizeGoogleConfig({ ga4Id: '  ', gtmId: '' })).toEqual({ ga4Id: '', gtmId: '', searchConsole: '', adsId: '' });
    expect(sanitizeGoogleConfig({ ga4Id: 'weird' }).ga4Id).toBe('weird');
  });
});
