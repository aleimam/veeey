import 'server-only';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { GSC_KEYS as K, SITE_URL, GSC_REDIRECT_PATH, defaultProperty, rangeDates } from '@/lib/gsc-config';

/**
 * Google Search Console integration (OAuth). Stores the OAuth client + refresh
 * token in Settings (same convention as the other provider secrets) and calls
 * the Webmasters v3 + URL Inspection APIs with a freshly-refreshed access token.
 * Everything degrades to "not connected" when unconfigured.
 */
export type GscConfig = { clientId: string; clientSecret: string; hasRefreshToken: boolean; property: string };

async function rawMap() {
  const rows = await prisma.setting.findMany({ where: { key: { in: Object.values(K) } } });
  return new Map(rows.map((r) => [r.key, r.value]));
}

export async function getGscConfig(): Promise<GscConfig> {
  const m = await rawMap();
  return {
    clientId: m.get(K.clientId) ?? '',
    clientSecret: m.get(K.clientSecret) ?? '',
    hasRefreshToken: !!m.get(K.refreshToken),
    property: m.get(K.property) || defaultProperty(),
  };
}

export const gscConnected = async () => (await getGscConfig()).hasRefreshToken;
export const redirectUri = () => `${SITE_URL}${GSC_REDIRECT_PATH}`;

async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

export async function saveGscClient(clientId: string, clientSecret: string, property: string): Promise<void> {
  const user = await requirePermission('settings.manage');
  await Promise.all([
    setSetting(K.clientId, clientId.trim()),
    ...(clientSecret.trim() ? [setSetting(K.clientSecret, clientSecret.trim())] : []),
    setSetting(K.property, property.trim() || defaultProperty()),
  ]);
  await audit({ actorType: 'USER', actorId: user.id, action: 'gsc.client.save', entityType: 'Setting', entityId: 'gsc.*' });
}

export async function disconnectGsc(): Promise<void> {
  const user = await requirePermission('settings.manage');
  await prisma.setting.deleteMany({ where: { key: K.refreshToken } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'gsc.disconnect', entityType: 'Setting', entityId: 'gsc.refreshToken' });
}

/** Exchange an OAuth code (from the consent callback) for a refresh token. */
export async function exchangeCode(code: string): Promise<{ ok: boolean; error?: string }> {
  const m = await rawMap();
  const clientId = m.get(K.clientId);
  const clientSecret = m.get(K.clientSecret);
  if (!clientId || !clientSecret) return { ok: false, error: 'client_not_configured' };
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri(), grant_type: 'authorization_code' }),
    });
    const json = (await res.json().catch(() => null)) as { refresh_token?: string; error?: string } | null;
    if (json?.refresh_token) {
      await setSetting(K.refreshToken, json.refresh_token);
      return { ok: true };
    }
    return { ok: false, error: json?.error ?? `http_${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 120) : 'exchange_error' };
  }
}

/** A short-lived access token from the stored refresh token, or null. */
async function accessToken(): Promise<string | null> {
  const m = await rawMap();
  const clientId = m.get(K.clientId);
  const clientSecret = m.get(K.clientSecret);
  const refreshToken = m.get(K.refreshToken);
  if (!clientId || !clientSecret || !refreshToken) return null;
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
    });
    const json = (await res.json().catch(() => null)) as { access_token?: string } | null;
    return json?.access_token ?? null;
  } catch {
    return null;
  }
}

async function api(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; json: unknown }> {
  const token = await accessToken();
  if (!token) return { ok: false, status: 0, json: { error: 'not_connected' } };
  const res = await fetch(`https://www.googleapis.com${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(15_000),
  });
  return { ok: res.ok, status: res.status, json: await res.json().catch(() => null) };
}

const propPath = (property: string) => encodeURIComponent(property);

/** Submit /sitemap.xml to the configured property. */
export async function submitSitemap(): Promise<{ ok: boolean; error?: string }> {
  const cfg = await getGscConfig();
  const feed = `${SITE_URL}/sitemap.xml`;
  const r = await api(`/webmasters/v3/sites/${propPath(cfg.property)}/sitemaps/${encodeURIComponent(feed)}`, { method: 'PUT' });
  if (r.ok) return { ok: true };
  const err = (r.json as { error?: { message?: string } } | null)?.error?.message;
  return { ok: false, error: err ?? `http_${r.status}` };
}

export type SitemapInfo = { path: string; lastSubmitted?: string; lastDownloaded?: string; isPending?: boolean; warnings?: string; errors?: string; submitted?: string; indexed?: string };

export async function listSitemaps(): Promise<{ ok: boolean; sitemaps: SitemapInfo[]; error?: string }> {
  const cfg = await getGscConfig();
  const r = await api(`/webmasters/v3/sites/${propPath(cfg.property)}/sitemaps`);
  if (!r.ok) return { ok: false, sitemaps: [], error: (r.json as { error?: { message?: string } } | null)?.error?.message ?? `http_${r.status}` };
  const raw = (r.json as { sitemap?: Array<Record<string, unknown>> } | null)?.sitemap ?? [];
  const sitemaps: SitemapInfo[] = raw.map((s) => {
    const contents = (s.contents as Array<{ submitted?: string; indexed?: string }> | undefined)?.[0];
    return {
      path: String(s.path ?? ''),
      lastSubmitted: s.lastSubmitted as string | undefined,
      lastDownloaded: s.lastDownloaded as string | undefined,
      isPending: s.isPending as boolean | undefined,
      warnings: s.warnings as string | undefined,
      errors: s.errors as string | undefined,
      submitted: contents?.submitted,
      indexed: contents?.indexed,
    };
  });
  return { ok: true, sitemaps };
}

/** URL Inspection — indexing/coverage status for one page. */
export async function inspectUrl(inspectionUrl: string): Promise<{ ok: boolean; verdict?: string; coverageState?: string; lastCrawl?: string; error?: string }> {
  const cfg = await getGscConfig();
  const token = await accessToken();
  if (!token) return { ok: false, error: 'not_connected' };
  try {
    const res = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ inspectionUrl, siteUrl: cfg.property }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => null)) as { inspectionResult?: { indexStatusResult?: { verdict?: string; coverageState?: string; lastCrawlTime?: string } }; error?: { message?: string } } | null;
    if (!res.ok) return { ok: false, error: json?.error?.message ?? `http_${res.status}` };
    const idx = json?.inspectionResult?.indexStatusResult;
    return { ok: true, verdict: idx?.verdict, coverageState: idx?.coverageState, lastCrawl: idx?.lastCrawlTime };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 120) : 'inspect_error' };
  }
}

export type SearchRow = { keys: string[]; clicks: number; impressions: number; ctr: number; position: number };
export type SearchSummary = { totals: { clicks: number; impressions: number; ctr: number; position: number }; topQueries: SearchRow[] };

/** Search-analytics: totals + top queries for the last `days` days. */
export async function searchPerformance(days: number, todayIso: string): Promise<{ ok: boolean; data?: SearchSummary; error?: string }> {
  const cfg = await getGscConfig();
  const { startDate, endDate } = rangeDates(days, todayIso);
  const [totalsRes, queriesRes] = await Promise.all([
    api(`/webmasters/v3/sites/${propPath(cfg.property)}/searchAnalytics/query`, { method: 'POST', body: JSON.stringify({ startDate, endDate }) }),
    api(`/webmasters/v3/sites/${propPath(cfg.property)}/searchAnalytics/query`, { method: 'POST', body: JSON.stringify({ startDate, endDate, dimensions: ['query'], rowLimit: 25 }) }),
  ]);
  if (!totalsRes.ok) return { ok: false, error: (totalsRes.json as { error?: { message?: string } } | null)?.error?.message ?? `http_${totalsRes.status}` };
  const t = (totalsRes.json as { rows?: SearchRow[] } | null)?.rows?.[0];
  const rows = (queriesRes.json as { rows?: SearchRow[] } | null)?.rows ?? [];
  return {
    ok: true,
    data: {
      totals: { clicks: t?.clicks ?? 0, impressions: t?.impressions ?? 0, ctr: t?.ctr ?? 0, position: t?.position ?? 0 },
      topQueries: rows,
    },
  };
}
