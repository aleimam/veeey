import { UAParser } from 'ua-parser-js';
import { isbot } from 'isbot';

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
