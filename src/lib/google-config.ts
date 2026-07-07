/** Pure Google-services config shape + sanitizer (no DB/auth imports, so it is
 *  unit-testable). The service layer (google-service.ts) reads/writes Settings. */

export const GOOGLE_KEYS = {
  ga4Id: 'google.ga4Id',
  gtmId: 'google.gtmId',
  searchConsole: 'google.searchConsole',
  adsId: 'google.adsConversionId',
} as const;

export type GoogleConfig = { ga4Id: string; gtmId: string; searchConsole: string; adsId: string };

/** Trim + light-normalize each id to its expected shape (empty = not set). */
export function sanitizeGoogleConfig(raw: Partial<GoogleConfig>): GoogleConfig {
  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  return {
    ga4Id: s(raw.ga4Id).toUpperCase().startsWith('G-') ? s(raw.ga4Id).toUpperCase() : s(raw.ga4Id),
    gtmId: s(raw.gtmId).toUpperCase().startsWith('GTM-') ? s(raw.gtmId).toUpperCase() : s(raw.gtmId),
    // Accept either the raw token or the full <meta> content value.
    searchConsole: s(raw.searchConsole).replace(/^.*content=["']?/, '').replace(/["'].*$/, ''),
    adsId: s(raw.adsId).toUpperCase().startsWith('AW-') ? s(raw.adsId).toUpperCase() : s(raw.adsId),
  };
}
