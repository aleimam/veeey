import { prisma } from '@/lib/prisma';

/**
 * WooCommerce REST connector (read-only) for egyptvitamins.com migration source.
 * Credentials are admin-entered (DB Setting `woo.*`, env fallback) — same pattern
 * as the other providers. Read-only + free of auth/server-only imports so admin
 * pages can import directly. Writers live in woocommerce-service.ts.
 */

export type WooConfig = { url: string; consumerKey: string; consumerSecret: string };
export type WooEntity = 'products' | 'customers' | 'orders' | 'products/categories' | 'coupons' | 'products/reviews';

async function rawMap(): Promise<Record<string, string>> {
  try {
    const rows = await prisma.setting.findMany({ where: { key: { startsWith: 'woo.' } } });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch {
    return {};
  }
}

let cache: { at: number; cfg: WooConfig | null } | null = null;
const TTL = 60_000;

export function invalidateWooCache() {
  cache = null;
}

export async function getWooConfig(): Promise<WooConfig | null> {
  const now = Date.now();
  if (cache && now - cache.at < TTL) return cache.cfg;
  const m = await rawMap();
  const url = (m['woo.url'] || process.env.WOO_URL || '').trim().replace(/\/+$/, '');
  const consumerKey = m['woo.consumerKey'] || process.env.WOO_CONSUMER_KEY || '';
  const consumerSecret = m['woo.consumerSecret'] || process.env.WOO_CONSUMER_SECRET || '';
  const cfg = url && consumerKey && consumerSecret ? { url, consumerKey, consumerSecret } : null;
  cache = { at: now, cfg };
  return cfg;
}

export const wooConfigured = async () => !!(await getWooConfig());

export async function getWooFormValues() {
  const m = await rawMap();
  return { url: m['woo.url'] ?? '', consumerKey: m['woo.consumerKey'] ?? '', hasSecret: !!m['woo.consumerSecret'] };
}

/** Scheduler + webhook settings for the admin sync page. */
export async function getSyncSettings() {
  const m = await rawMap();
  return {
    enabled: m['woo.sync.enabled'] === 'true',
    products: m['woo.sync.products'] !== 'false',
    customers: m['woo.sync.customers'] !== 'false',
    orders: m['woo.sync.orders'] !== 'false',
    hasWebhookSecret: !!m['woo.webhookSecret'],
  };
}

/** Shared secret for verifying inbound WooCommerce webhooks (DB → env fallback). */
export async function getWebhookSecret(): Promise<string> {
  const r = await prisma.setting.findUnique({ where: { key: 'woo.webhookSecret' } });
  return r?.value || process.env.WOO_WEBHOOK_SECRET || '';
}

export type WooPage = { data: unknown[]; total: number; totalPages: number };

/**
 * Authenticated GET against the WooCommerce REST API (Basic auth over HTTPS).
 * Returns the parsed list plus the X-WP-Total / X-WP-TotalPages headers.
 * Throws on missing config or non-2xx. Read-only — never mutates the source.
 */
export async function wooFetch(path: WooEntity | string, params: Record<string, string | number> = {}, timeoutMs = 20_000): Promise<WooPage> {
  const cfg = await getWooConfig();
  if (!cfg) throw new Error('WOO_NOT_CONFIGURED');
  const url = new URL(`${cfg.url}/wp-json/wc/v3/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const auth = Buffer.from(`${cfg.consumerKey}:${cfg.consumerSecret}`).toString('base64');
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = (await res.json()) as { message?: string };
      detail = body?.message ? ` — ${body.message}` : '';
    } catch {
      // ignore
    }
    throw new Error(`WOO_HTTP_${res.status}${detail}`);
  }
  const data = (await res.json()) as unknown[];
  return {
    data: Array.isArray(data) ? data : [],
    total: Number(res.headers.get('x-wp-total') ?? (Array.isArray(data) ? data.length : 0)),
    totalPages: Number(res.headers.get('x-wp-totalpages') ?? 1),
  };
}

/** Entity slug → WooCommerce REST endpoint (shared by browse + detail pages). */
export const WOO_ENTITY_ENDPOINT: Record<string, WooEntity> = {
  products: 'products',
  customers: 'customers',
  orders: 'orders',
  categories: 'products/categories',
  coupons: 'coupons',
  reviews: 'products/reviews',
};

/** Fetch a single record by id (e.g. products/123). Null on 404; throws otherwise. */
export async function wooFetchOne(path: WooEntity | string, id: string): Promise<Record<string, unknown> | null> {
  const cfg = await getWooConfig();
  if (!cfg) throw new Error('WOO_NOT_CONFIGURED');
  const url = `${cfg.url}/wp-json/wc/v3/${path}/${encodeURIComponent(id)}`;
  const auth = Buffer.from(`${cfg.consumerKey}:${cfg.consumerSecret}`).toString('base64');
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`WOO_HTTP_${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

/** Total row count for an entity (per_page=1, reads X-WP-Total). 0 on error. */
export async function wooCount(path: WooEntity): Promise<number | null> {
  try {
    const { total } = await wooFetch(path, { per_page: 1 });
    return total;
  } catch {
    return null;
  }
}

/** Verify the connection + return per-entity counts for the overview. */
export async function wooOverview(): Promise<{ ok: boolean; error?: string; counts: Record<string, number | null> }> {
  try {
    const products = await wooFetch('products', { per_page: 1 });
    const [customers, orders, categories, coupons, reviews] = await Promise.all([
      wooCount('customers'),
      wooCount('orders'),
      wooCount('products/categories'),
      wooCount('coupons'),
      wooCount('products/reviews'),
    ]);
    return { ok: true, counts: { products: products.total, customers, orders, categories, coupons, reviews } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'ERROR', counts: {} };
  }
}
