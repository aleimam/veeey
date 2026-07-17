import { UAParser } from 'ua-parser-js';
import { isbot } from 'isbot';

/**
 * Crawler / SEO-tool referrer domains (V5 audit F8): sessions arriving from
 * these are automation even when the UA looks like a normal browser, so the
 * UA-only `isbot` check misses them. Matched against the referrer's host
 * (suffix match, so subdomains count).
 */
const CRAWLER_REFERRER_HOSTS = [
  'semrush.com', 'ahrefs.com', 'majestic.com', 'moz.com', 'mj12bot.com',
  'petalsearch.com', 'semalt.com', 'baidu.com', 'yandex.ru',
  'dotnetdotcom.org', 'dataforseo.com', 'serpstat.com', 'screaming frog'.replace(' ', ''),
  'buttons-for-website.com', 'best-seo-offer.com', '4webmasters.org',
];

/** True when the referrer host is a known crawler / SEO-tool / spam domain. */
export function isCrawlerReferrer(referrer: string | null | undefined): boolean {
  if (!referrer) return false;
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    return CRAWLER_REFERRER_HOSTS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

/**
 * Pure visitor-enrichment helpers (Analytics P1). No DB / network → unit-testable.
 * Used server-side by the ingest pipeline to turn request headers into structured
 * device/OS/browser fields, and to anonymize the IP for the `ipTruncated` column.
 */

export type DeviceInfo = {
  os: string | null;
  osVersion: string | null;
  browser: string | null;
  browserVersion: string | null;
  deviceType: string; // mobile | tablet | desktop | bot
  isBot: boolean;
};

/** Parse a User-Agent string into structured device/OS/browser + a bot flag. */
export function parseUserAgent(ua: string | null | undefined): DeviceInfo {
  const s = (ua ?? '').slice(0, 1024);
  const bot = s ? isbot(s) : false;
  const r = new UAParser(s).getResult();
  const dt = r.device.type; // 'mobile' | 'tablet' | 'console' | 'smarttv' | 'wearable' | undefined
  const deviceType = bot ? 'bot' : dt === 'mobile' ? 'mobile' : dt === 'tablet' ? 'tablet' : 'desktop';
  return {
    os: r.os.name ?? null,
    osVersion: r.os.version ?? null,
    browser: r.browser.name ?? null,
    browserVersion: r.browser.version ?? null,
    deviceType,
    isBot: bot,
  };
}

/** Client IP from an X-Forwarded-For chain (first hop) or a single header value. */
export function clientIp(xff: string | null | undefined, realIp?: string | null): string | null {
  const first = (xff ?? '').split(',')[0]?.trim();
  const ip = first || (realIp ?? '').trim();
  return ip ? ip.slice(0, 45) : null; // 45 = max IPv6 text length
}

/** Anonymize an IP: zero the last IPv4 octet, or truncate IPv6 to ~/48. */
export function truncateIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  if (ip.includes('.')) {
    const p = ip.split('.');
    if (p.length === 4) {
      p[3] = '0';
      return p.join('.');
    }
    return ip;
  }
  if (ip.includes(':')) {
    return ip.split(':').slice(0, 3).join(':') + '::';
  }
  return ip;
}

/** Primary language tag from an Accept-Language header (e.g. "ar-EG,ar;q=0.9" → "ar-EG"). */
export function primaryLanguage(al: string | null | undefined): string | null {
  const first = (al ?? '').split(',')[0]?.trim().split(';')[0]?.trim();
  return first ? first.slice(0, 35) : null;
}
