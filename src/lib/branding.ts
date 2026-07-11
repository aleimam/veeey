/**
 * Site branding (admin-editable favicon / logos / titles). Pure module — no
 * prisma/auth imports so it stays vitest-friendly; persistence lives in
 * branding-service.ts (Settings keys `branding.*`).
 */
export type Branding = {
  /** Brand name shown in headers, JSON-LD and the PWA manifest. */
  siteNameEn: string;
  siteNameAr: string;
  /** Default browser-tab title (pages with their own title override it). */
  titleEn: string;
  titleAr: string;
  /** Main logo (light backgrounds). Empty = built-in Veeey artwork. */
  logoUrl: string;
  /** White-knockout logo (green header / dark backgrounds). Empty = built-in. */
  logoLightUrl: string;
  /** Favicon URL (uploaded PNG). Empty = bundled favicon.ico. */
  faviconUrl: string;
};

export const DEFAULT_BRANDING: Branding = {
  siteNameEn: 'Veeey',
  siteNameAr: 'Veeey',
  titleEn: 'Veeey — Premium Imported Supplements & Health Devices in Egypt',
  titleAr: 'Veeey — مكملات غذائية وأجهزة صحية مستوردة أصلية في مصر',
  logoUrl: '',
  logoLightUrl: '',
  faviconUrl: '',
};

const KEYS = Object.keys(DEFAULT_BRANDING) as (keyof Branding)[];

/** Normalize a raw key→value map into a full Branding (trimmed, defaulted).
 *  Image fields only accept site-relative or http(s) URLs. */
export function parseBranding(raw: Record<string, string | undefined>): Branding {
  const out = { ...DEFAULT_BRANDING };
  for (const key of KEYS) {
    const v = (raw[key] ?? '').trim();
    if (!v) continue;
    if ((key === 'logoUrl' || key === 'logoLightUrl' || key === 'faviconUrl') && !/^(\/|https?:\/\/)/i.test(v)) continue;
    out[key] = v;
  }
  return out;
}

export const brandingSiteName = (b: Branding, locale: string) => (locale === 'ar' ? b.siteNameAr : b.siteNameEn);
export const brandingTitle = (b: Branding, locale: string) => (locale === 'ar' ? b.titleAr : b.titleEn);
