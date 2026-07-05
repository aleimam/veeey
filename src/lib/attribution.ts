/**
 * Order attribution (owner batch #7). Automatic traffic-source capture that
 * lives ALONGSIDE the manual Channel field (Order.source): the proxy stores the
 * last non-direct touch (UTM params / click ids / external referrer) in a
 * cookie, checkout snapshots it onto Order.utmJson, and admin derives a
 * readable label (Google Ads / Google Organic / Meta / Referral / Direct /
 * Other) for the order page + the sources report. Pure module — no Next
 * imports — so the derivation rules are unit-testable.
 */

export const ATTR_COOKIE = 'veeey-attr';
export const ATTR_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type Attribution = {
  source?: string; // utm_source
  medium?: string; // utm_medium
  campaign?: string; // utm_campaign
  term?: string; // utm_term
  content?: string; // utm_content
  clickId?: 'gclid' | 'fbclid' | 'ttclid';
  referrer?: string; // external referrer host
  landing?: string; // first path seen with this touch
  at?: string; // ISO timestamp of the touch
};

const UTM_KEYS = ['source', 'medium', 'campaign', 'term', 'content'] as const;
const CLICK_IDS = ['gclid', 'fbclid', 'ttclid'] as const;

/** Hosts that count as "self" traffic and never produce a referral touch. */
function isInternalHost(host: string | null, selfHost: string): boolean {
  if (!host) return true;
  const h = host.toLowerCase();
  const s = selfHost.toLowerCase();
  return h === s || h.endsWith(`.${s}`) || s.endsWith(`.${h}`);
}

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host || null;
  } catch {
    return null;
  }
}

/**
 * Last-non-direct-touch capture. Returns the serialized cookie value to set,
 * or null to keep whatever is already stored:
 * - UTM params or an ad click-id present → always (re)write the touch.
 * - External referrer → write only when no touch is stored yet (organic /
 *   referral never overwrites a captured campaign).
 * - Plain direct hit → never writes.
 */
export function captureAttribution(
  url: URL,
  referer: string | null,
  existingRaw: string | null | undefined,
): string | null {
  const attr: Attribution = {};
  for (const k of UTM_KEYS) {
    const v = url.searchParams.get(`utm_${k}`);
    if (v) attr[k] = v.slice(0, 120);
  }
  for (const id of CLICK_IDS) {
    if (url.searchParams.get(id)) {
      attr.clickId = id;
      break;
    }
  }
  const refHost = hostOf(referer);
  const external = refHost != null && !isInternalHost(refHost, url.host);
  if (external) attr.referrer = refHost!;

  const hasCampaign = attr.source != null || attr.clickId != null;
  if (!hasCampaign && (!external || existingRaw)) return null;

  attr.landing = url.pathname;
  attr.at = new Date().toISOString();
  return encodeURIComponent(JSON.stringify(attr));
}

export function parseAttribution(raw: string | null | undefined): Attribution | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(decodeURIComponent(raw));
    return v && typeof v === 'object' ? (v as Attribution) : null;
  } catch {
    return null;
  }
}

export type SourceKey = 'GOOGLE_ADS' | 'GOOGLE_ORGANIC' | 'META' | 'REFERRAL' | 'DIRECT' | 'OTHER';

const PAID_MEDIUMS = new Set(['cpc', 'ppc', 'paid', 'paidsearch', 'paid_social', 'cpm', 'display', 'ads']);
const META_SOURCES = new Set(['facebook', 'fb', 'instagram', 'ig', 'meta', 'messenger']);

/** Derive the readable source bucket from a stored attribution snapshot. */
export function deriveSourceKey(attr: Attribution | null | undefined): SourceKey {
  if (!attr || (Object.keys(attr) as (keyof Attribution)[]).every((k) => attr[k] == null)) return 'DIRECT';
  const source = attr.source?.toLowerCase() ?? '';
  const medium = attr.medium?.toLowerCase() ?? '';
  const ref = attr.referrer?.toLowerCase() ?? '';

  const isGoogle = source === 'google' || /(^|\.)google\./.test(ref);
  const isMeta = META_SOURCES.has(source) || /facebook\.com|instagram\.com|fb\.com/.test(ref);

  if (attr.clickId === 'gclid' || (isGoogle && PAID_MEDIUMS.has(medium))) return 'GOOGLE_ADS';
  if (attr.clickId === 'fbclid' || isMeta) return 'META';
  if (isGoogle) return 'GOOGLE_ORGANIC';
  if (attr.source || attr.clickId) return 'OTHER';
  if (attr.referrer) return 'REFERRAL';
  return 'DIRECT';
}

const SOURCE_LABELS: Record<SourceKey, { en: string; ar: string }> = {
  GOOGLE_ADS: { en: 'Google Ads', ar: 'إعلانات جوجل' },
  GOOGLE_ORGANIC: { en: 'Google Organic', ar: 'بحث جوجل' },
  META: { en: 'Meta (FB/IG)', ar: 'ميتا (فيسبوك/إنستجرام)' },
  REFERRAL: { en: 'Referral', ar: 'إحالة' },
  DIRECT: { en: 'Direct', ar: 'مباشر' },
  OTHER: { en: 'Other campaign', ar: 'حملة أخرى' },
};

export function sourceLabel(key: SourceKey, locale = 'en'): string {
  return locale === 'ar' ? SOURCE_LABELS[key].ar : SOURCE_LABELS[key].en;
}

export const SOURCE_KEYS: SourceKey[] = ['GOOGLE_ADS', 'GOOGLE_ORGANIC', 'META', 'REFERRAL', 'DIRECT', 'OTHER'];

/** Compact one-line detail for admin display, e.g. "google / cpc · summer-sale · ref: google.com". */
export function attributionDetail(attr: Attribution | null | undefined): string {
  if (!attr) return '';
  const parts: string[] = [];
  if (attr.source || attr.medium) parts.push([attr.source, attr.medium].filter(Boolean).join(' / '));
  if (attr.campaign) parts.push(attr.campaign);
  if (attr.clickId) parts.push(attr.clickId);
  if (attr.referrer) parts.push(`ref: ${attr.referrer}`);
  return parts.join(' · ');
}
