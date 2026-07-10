import { prisma } from '@/lib/prisma';
import { fillDailySeries, topBuckets, pct, abandonmentRate, bounceRate, type Bucket } from './analytics';

/**
 * P2 commerce-joined + enrichment-driven analytics (FR-ANL-*). Everything here is
 * bot-filtered (AnalyticsSession.isBot = false) and windowed to the last `days`.
 * The persistent-visitor model: one AnalyticsSession per browser (localStorage id),
 * so "visitor" = distinct session; "active in window" = lastSeenAt within it.
 */
const sinceDate = (days: number) => new Date(Date.now() - days * 86_400_000);

/** Daily visitors + pageviews for the traffic chart (gaps filled with zeros). */
export async function visitorTimeSeries(days = 30): Promise<Array<{ date: string; visitors: number; pageviews: number }>> {
  const start = sinceDate(days);
  const rows = await prisma.$queryRaw<Array<{ d: string; visitors: number; pageviews: number }>>`
    SELECT to_char(date_trunc('day', e."createdAt"), 'YYYY-MM-DD') AS d,
           count(*)::int AS pageviews,
           count(DISTINCT e."sessionId")::int AS visitors
    FROM "AnalyticsEvent" e
    JOIN "AnalyticsSession" s ON s."sessionId" = e."sessionId"
    WHERE e.type = 'page_view' AND e."createdAt" >= ${start} AND s."isBot" = false
    GROUP BY 1 ORDER BY 1`;
  const byDate = new Map(rows.map((r) => [r.d, { visitors: r.visitors, pageviews: r.pageviews }]));
  return fillDailySeries(Date.now(), days, byDate, { visitors: 0, pageviews: 0 });
}

/** Audience breakdown from the enriched sessions (device / country / browser / OS). */
export async function audienceBreakdown(days = 30): Promise<{ devices: Bucket[]; countries: Bucket[]; browsers: Bucket[]; os: Bucket[] }> {
  const where = { isBot: false, lastSeenAt: { gte: sinceDate(days) } };
  const [devices, countries, browsers, oses] = await Promise.all([
    prisma.analyticsSession.groupBy({ by: ['deviceType'], where, _count: { _all: true } }),
    prisma.analyticsSession.groupBy({ by: ['country'], where, _count: { _all: true } }),
    prisma.analyticsSession.groupBy({ by: ['browser'], where, _count: { _all: true } }),
    prisma.analyticsSession.groupBy({ by: ['os'], where, _count: { _all: true } }),
  ]);
  const buckets = <R extends { _count: { _all: number } }>(rows: R[], key: (r: R) => string | null, limit = 8) =>
    topBuckets(rows.map((r) => ({ key: key(r), count: r._count._all })), { limit });
  return {
    devices: buckets(devices, (r) => r.deviceType, 5),
    countries: buckets(countries, (r) => r.country, 10),
    browsers: buckets(browsers, (r) => r.browser),
    os: buckets(oses, (r) => r.os),
  };
}

/** New vs returning visitors active in the window. */
export async function newVsReturning(days = 30): Promise<{ new: number; returning: number; total: number }> {
  const start = sinceDate(days);
  const [active, newcomers] = await Promise.all([
    prisma.analyticsSession.count({ where: { isBot: false, lastSeenAt: { gte: start } } }),
    prisma.analyticsSession.count({ where: { isBot: false, startedAt: { gte: start } } }),
  ]);
  return { new: newcomers, returning: Math.max(0, active - newcomers), total: active };
}

/** Engagement: avg dwell, single-page (bounce) rate, pages/visitor, top pages by dwell. */
export async function engagement(days = 30): Promise<{
  visitors: number;
  pageviews: number;
  pagesPerVisitor: number;
  bounceRate: number;
  avgDwellMs: number;
  topPages: Array<{ path: string; views: number; avgDwellMs: number }>;
}> {
  const start = sinceDate(days);
  const [sessRows, dwellRow, topPages] = await Promise.all([
    prisma.$queryRaw<Array<{ visitors: number; pageviews: number; single_page: number }>>`
      WITH pv AS (
        SELECT e."sessionId" AS sid, count(*)::int AS views
        FROM "AnalyticsEvent" e JOIN "AnalyticsSession" s ON s."sessionId" = e."sessionId"
        WHERE e.type = 'page_view' AND e."createdAt" >= ${start} AND s."isBot" = false AND e."sessionId" IS NOT NULL
        GROUP BY 1
      )
      SELECT count(*)::int AS visitors, coalesce(sum(views),0)::int AS pageviews, count(*) FILTER (WHERE views = 1)::int AS single_page FROM pv`,
    prisma.$queryRaw<Array<{ avg_dwell_ms: number }>>`
      SELECT coalesce(round(avg(e."durationMs")),0)::int AS avg_dwell_ms
      FROM "AnalyticsEvent" e JOIN "AnalyticsSession" s ON s."sessionId" = e."sessionId"
      WHERE e.type = 'page_leave' AND e."durationMs" IS NOT NULL AND e."createdAt" >= ${start} AND s."isBot" = false`,
    prisma.$queryRaw<Array<{ path: string; views: number; avg_dwell_ms: number }>>`
      SELECT e.path AS path,
             count(*) FILTER (WHERE e.type = 'page_view')::int AS views,
             coalesce(round(avg(e."durationMs") FILTER (WHERE e.type = 'page_leave' AND e."durationMs" IS NOT NULL)),0)::int AS avg_dwell_ms
      FROM "AnalyticsEvent" e JOIN "AnalyticsSession" s ON s."sessionId" = e."sessionId"
      WHERE e."createdAt" >= ${start} AND s."isBot" = false AND e.path IS NOT NULL
      GROUP BY e.path ORDER BY views DESC LIMIT 15`,
  ]);
  const s = sessRows[0] ?? { visitors: 0, pageviews: 0, single_page: 0 };
  return {
    visitors: s.visitors,
    pageviews: s.pageviews,
    pagesPerVisitor: s.visitors > 0 ? Math.round((s.pageviews / s.visitors) * 10) / 10 : 0,
    bounceRate: bounceRate(s.single_page, s.visitors),
    avgDwellMs: dwellRow[0]?.avg_dwell_ms ?? 0,
    topPages: topPages.map((p) => ({ path: p.path, views: p.views, avgDwellMs: p.avg_dwell_ms })),
  };
}

/** Cart → checkout → order abandonment (distinct sessions per stage + real orders). */
export async function cartFunnel(days = 30): Promise<{
  cartSessions: number;
  checkoutSessions: number;
  webOrders: number;
  cartAbandonment: number;
  checkoutAbandonment: number;
}> {
  const start = sinceDate(days);
  const distinctSessions = async (type: string) =>
    (await prisma.analyticsEvent.groupBy({ by: ['sessionId'], where: { type, createdAt: { gte: start }, sessionId: { not: null }, session: { is: { isBot: false } } } })).length;
  const [cartSessions, checkoutSessions, webOrders] = await Promise.all([
    distinctSessions('add_to_cart'),
    distinctSessions('checkout_step'),
    prisma.order.count({ where: { placedAt: { gte: start }, source: 'DIRECT' } }),
  ]);
  return {
    cartSessions,
    checkoutSessions,
    webOrders,
    cartAbandonment: abandonmentRate(cartSessions, checkoutSessions),
    checkoutAbandonment: abandonmentRate(checkoutSessions, Math.min(webOrders, checkoutSessions)),
  };
}

/** Internal search: most-searched terms + terms returning zero results (merchandising gaps). */
export async function searchInsights(days = 30, limit = 15): Promise<{ top: Array<{ q: string; count: number }>; zeroResults: Array<{ q: string; count: number }> }> {
  const events = await prisma.analyticsEvent.findMany({ where: { type: 'search', createdAt: { gte: sinceDate(days) } }, select: { propsJson: true }, take: 8000 });
  const tally = new Map<string, { count: number; zero: number }>();
  for (const e of events) {
    const props = e.propsJson as { q?: string; results?: number } | null;
    const q = props?.q?.trim().toLowerCase();
    if (!q) continue;
    const t = tally.get(q) ?? { count: 0, zero: 0 };
    t.count += 1;
    if (props?.results === 0) t.zero += 1;
    tally.set(q, t);
  }
  const entries = [...tally.entries()];
  return {
    top: entries.map(([q, v]) => ({ q, count: v.count })).sort((a, b) => b.count - a.count).slice(0, limit),
    zeroResults: entries.filter(([, v]) => v.zero > 0).map(([q, v]) => ({ q, count: v.zero })).sort((a, b) => b.count - a.count).slice(0, limit),
  };
}

/** Product performance: views (clickstream) vs units sold (orders) → view→buy rate. */
export async function productPerformance(days = 30, limit = 12): Promise<Array<{ sku: string; name: string; views: number; units: number; conversion: number }>> {
  const start = sinceDate(days);
  const viewEvents = await prisma.analyticsEvent.findMany({
    where: { type: 'product_view', createdAt: { gte: start }, session: { is: { isBot: false } } },
    select: { propsJson: true },
    take: 20000,
  });
  const bySku = new Map<string, number>();
  for (const e of viewEvents) {
    const sku = (e.propsJson as { sku?: string } | null)?.sku;
    if (sku) bySku.set(sku, (bySku.get(sku) ?? 0) + 1);
  }
  const topSkus = [...bySku.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([sku]) => sku);
  if (topSkus.length === 0) return [];
  const products = await prisma.product.findMany({ where: { sku: { in: topSkus } }, select: { id: true, sku: true, nameEn: true } });
  const idBySku = new Map(products.map((p) => [p.sku, p.id]));
  const nameBySku = new Map(products.map((p) => [p.sku, p.nameEn]));
  const units = await prisma.orderItem.groupBy({
    by: ['productId'],
    where: { productId: { in: products.map((p) => p.id) }, order: { placedAt: { gte: start } } },
    _sum: { qty: true },
  });
  const unitsByProduct = new Map(units.map((u) => [u.productId, u._sum.qty ?? 0]));
  return topSkus.map((sku) => {
    const views = bySku.get(sku) ?? 0;
    const unitsSold = unitsByProduct.get(idBySku.get(sku) ?? '') ?? 0;
    return { sku, name: nameBySku.get(sku) ?? sku, views, units: unitsSold, conversion: pct(unitsSold, views) };
  });
}
