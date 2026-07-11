import { describe, expect, it } from 'vitest';
import { DEFAULT_BRANDING, parseBranding, brandingSiteName, brandingTitle } from '@/lib/branding';

describe('parseBranding', () => {
  it('returns shipped defaults for an empty map', () => {
    expect(parseBranding({})).toEqual(DEFAULT_BRANDING);
  });

  it('keeps provided values and trims whitespace', () => {
    const b = parseBranding({ siteNameEn: '  Acme  ', titleAr: 'عنوان', logoUrl: '/uploads/logo.webp' });
    expect(b.siteNameEn).toBe('Acme');
    expect(b.titleAr).toBe('عنوان');
    expect(b.logoUrl).toBe('/uploads/logo.webp');
    expect(b.siteNameAr).toBe(DEFAULT_BRANDING.siteNameAr);
  });

  it('falls back to defaults for blank values', () => {
    const b = parseBranding({ siteNameEn: '   ', titleEn: '' });
    expect(b.siteNameEn).toBe(DEFAULT_BRANDING.siteNameEn);
    expect(b.titleEn).toBe(DEFAULT_BRANDING.titleEn);
  });

  it('rejects non-URL image values (javascript:, bare text)', () => {
    const b = parseBranding({ faviconUrl: 'javascript:alert(1)', logoUrl: 'not-a-url', logoLightUrl: 'https://cdn.example.com/l.png' });
    expect(b.faviconUrl).toBe('');
    expect(b.logoUrl).toBe('');
    expect(b.logoLightUrl).toBe('https://cdn.example.com/l.png');
  });

  it('locale helpers pick the right language', () => {
    const b = parseBranding({ siteNameEn: 'Acme', siteNameAr: 'أكمي', titleEn: 'T-EN', titleAr: 'T-AR' });
    expect(brandingSiteName(b, 'en')).toBe('Acme');
    expect(brandingSiteName(b, 'ar')).toBe('أكمي');
    expect(brandingTitle(b, 'en')).toBe('T-EN');
    expect(brandingTitle(b, 'ar')).toBe('T-AR');
  });
});
