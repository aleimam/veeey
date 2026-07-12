/**
 * Google Search Console OAuth config (pure module — no prisma/server imports so
 * it stays vitest-friendly). Persistence + API calls live in gsc-service.ts.
 * The `webmasters` scope covers sitemap submit + search analytics; URL
 * inspection uses the same OAuth token via the Search Console API.
 */
export const GSC_KEYS = {
  clientId: 'gsc.clientId',
  clientSecret: 'gsc.clientSecret',
  refreshToken: 'gsc.refreshToken',
  property: 'gsc.property',
} as const;

export const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters';
export const GSC_REDIRECT_PATH = '/api/admin/google/gsc/callback';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://veeey.com').replace(/\/$/, '');

/** Google consent-screen URL for the offline (refresh-token) flow. */
export function gscAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GSC_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q.toString()}`;
}

/** Default GSC property = the URL-prefix form of the site (matches the existing
 *  meta-tag verification). Admin can override with a domain (`sc-domain:…`)
 *  property if that's how their Search Console is set up. */
export function defaultProperty(siteUrl = SITE_URL): string {
  return `${siteUrl}/`;
}

// CSRF state for the OAuth round-trip (HMAC, 10-min TTL).
import { createHmac, timingSafeEqual } from 'node:crypto';
const stateSecret = () => process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'veeey-dev-secret';

export function makeOauthState(now: number): string {
  const exp = now + 600_000;
  const mac = createHmac('sha256', stateSecret()).update(`gsc|${exp}`).digest('base64url');
  return `${exp}.${mac}`;
}

export function verifyOauthState(state: string | null | undefined, now: number): boolean {
  if (!state) return false;
  const [expStr, mac] = state.split('.');
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < now || !mac) return false;
  const expected = createHmac('sha256', stateSecret()).update(`gsc|${exp}`).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** GSC search-analytics date range from a preset (inclusive, Google's TZ). */
export function rangeDates(days: number, todayIso: string): { startDate: string; endDate: string } {
  const end = new Date(todayIso);
  end.setUTCDate(end.getUTCDate() - 2); // GSC data lags ~2 days
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}
