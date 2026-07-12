import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';

/**
 * Search analytics (FR-SCH-01). Everything is windowed to the last `days` and
 * built from the SearchQuery / SearchClick logs written on every storefront
 * search + result click. "Purchase-driving" is an attribution proxy: a clicked
 * product that later appears in a paid order line within the window — it does not
 * prove the click caused the sale, but it ranks terms that lead shoppers to
 * things that sell. Zero-result terms feed the merchandising / synonym tools.
 */
const sinceDate = (days: number) => new Date(Date.now() - days * 86_400_000);

export type SearchTermRow = {
  term: string;
  normalized: string;
  searches: number;
  avgResults: number;
  zeroRate: number; // fraction of these searches that returned nothing
  clicks: number;
  ctr: number; // clicks / searches (capped at 1)
};

export type ZeroTermRow = { term: string; normalized: string; searches: number };
export type DrivingTermRow = { term: string; normalized: string; clicks: number; soldClicks: number };

export type SearchOverview = {
  days: number;
  totalSearches: number;
  totalClicks: number;
  zeroResultSearches: number;
  sessions: number;
  ctr: number; // clicks / searches
  zeroRate: number; // zero-result searches / searches
  funnel: { searches: number; clicks: number; soldClicks: number };
  topTerms: SearchTermRow[];
  zeroTerms: ZeroTermRow[];
  drivingTerms: DrivingTermRow[];
};

export async function searchOverview(days = 30): Promise<SearchOverview> {
  const start = sinceDate(days);

  const [totalsRows, clickRows, topRows, zeroRows, drivingRows, soldRows] = await Promise.all([
    prisma.$queryRaw<Array<{ searches: number; zero: number; sessions: number }>>`
      SELECT count(*)::int AS searches,
             count(*) FILTER (WHERE "resultCount" = 0)::int AS zero,
             count(DISTINCT "sessionId")::int AS sessions
      FROM "SearchQuery" WHERE "createdAt" >= ${start}`,
    prisma.$queryRaw<Array<{ clicks: number }>>`
      SELECT count(*)::int AS clicks FROM "SearchClick" WHERE "createdAt" >= ${start}`,
    prisma.$queryRaw<Array<{ normalized: string; term: string; searches: number; avg_results: number; zero_rate: number; clicks: number }>>`
      SELECT q.normalized AS normalized,
             (array_agg(q.term ORDER BY q."createdAt" DESC))[1] AS term,
             count(*)::int AS searches,
             avg(q."resultCount")::float AS avg_results,
             (count(*) FILTER (WHERE q."resultCount" = 0)::float / count(*)) AS zero_rate,
             coalesce(c.clicks, 0)::int AS clicks
      FROM "SearchQuery" q
      LEFT JOIN (
        SELECT normalized, count(*)::int AS clicks FROM "SearchClick"
        WHERE "createdAt" >= ${start} GROUP BY normalized
      ) c ON c.normalized = q.normalized
      WHERE q."createdAt" >= ${start}
      GROUP BY q.normalized, c.clicks
      ORDER BY searches DESC
      LIMIT 50`,
    prisma.$queryRaw<Array<{ normalized: string; term: string; searches: number }>>`
      SELECT normalized,
             (array_agg(term ORDER BY "createdAt" DESC))[1] AS term,
             count(*)::int AS searches
      FROM "SearchQuery"
      WHERE "createdAt" >= ${start} AND "resultCount" = 0
      GROUP BY normalized
      ORDER BY searches DESC
      LIMIT 50`,
    prisma.$queryRaw<Array<{ normalized: string; clicks: number; sold_clicks: number }>>`
      SELECT sc.normalized AS normalized,
             count(*)::int AS clicks,
             count(*) FILTER (WHERE EXISTS (
               SELECT 1 FROM "OrderItem" oi
               JOIN "Order" o ON o.id = oi."orderId"
               WHERE oi."productId" = sc."productId"
                 AND oi.lost = false AND oi.preorder = false
                 AND o."createdAt" >= sc."createdAt"
             ))::int AS sold_clicks
      FROM "SearchClick" sc
      WHERE sc."createdAt" >= ${start} AND sc."productId" IS NOT NULL
      GROUP BY sc.normalized
      ORDER BY sold_clicks DESC, clicks DESC
      LIMIT 50`,
    prisma.$queryRaw<Array<{ sold: number }>>`
      SELECT count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM "OrderItem" oi
        JOIN "Order" o ON o.id = oi."orderId"
        WHERE oi."productId" = sc."productId"
          AND oi.lost = false AND oi.preorder = false
          AND o."createdAt" >= sc."createdAt"
      ))::int AS sold
      FROM "SearchClick" sc
      WHERE sc."createdAt" >= ${start} AND sc."productId" IS NOT NULL`,
  ]);

  const totals = totalsRows[0] ?? { searches: 0, zero: 0, sessions: 0 };
  const totalClicks = clickRows[0]?.clicks ?? 0;
  const soldClicks = soldRows[0]?.sold ?? 0;

  // SearchClick only stores the normalized form; resolve a friendly display term.
  const driveNorms = drivingRows.map((r) => r.normalized);
  const termMap = new Map<string, string>();
  if (driveNorms.length) {
    const labels = await prisma.$queryRaw<Array<{ normalized: string; term: string }>>`
      SELECT DISTINCT ON (normalized) normalized, term
      FROM "SearchQuery" WHERE normalized IN (${Prisma.join(driveNorms)})
      ORDER BY normalized, "createdAt" DESC`;
    for (const l of labels) termMap.set(l.normalized, l.term);
  }

  const ctr = totals.searches > 0 ? Math.min(1, totalClicks / totals.searches) : 0;
  const zeroRate = totals.searches > 0 ? totals.zero / totals.searches : 0;

  return {
    days,
    totalSearches: totals.searches,
    totalClicks,
    zeroResultSearches: totals.zero,
    sessions: totals.sessions,
    ctr,
    zeroRate,
    funnel: { searches: totals.searches, clicks: totalClicks, soldClicks },
    topTerms: topRows.map((r) => ({
      term: r.term,
      normalized: r.normalized,
      searches: r.searches,
      avgResults: Math.round((r.avg_results ?? 0) * 10) / 10,
      zeroRate: r.zero_rate ?? 0,
      clicks: r.clicks,
      ctr: r.searches > 0 ? Math.min(1, r.clicks / r.searches) : 0,
    })),
    zeroTerms: zeroRows.map((r) => ({ term: r.term, normalized: r.normalized, searches: r.searches })),
    drivingTerms: drivingRows.map((r) => ({
      term: termMap.get(r.normalized) ?? r.normalized,
      normalized: r.normalized,
      clicks: r.clicks,
      soldClicks: r.sold_clicks,
    })),
  };
}

export type DemandProduct = { productId: string; nameEn: string; nameAr: string | null; slugEn: string; clicks: number; preorder: boolean };
export type UnstockedDemand = { days: number; outOfStock: DemandProduct[]; zeroResult: ZeroTermRow[] };

/**
 * "What should we restock / source?" (search extra #1). Two signals:
 *  - outOfStock: products shoppers clicked from search that currently have no
 *    sellable stock (no LIVE lot with qty on hand) — restock candidates.
 *  - zeroResult: normalized terms that returned nothing — source / alias candidates.
 */
export async function unstockedDemand(days = 30): Promise<UnstockedDemand> {
  const start = sinceDate(days);
  const [outOfStock, zeroResult] = await Promise.all([
    prisma.$queryRaw<Array<{ product_id: string; name_en: string; name_ar: string | null; slug_en: string; clicks: number; preorder: boolean }>>`
      SELECT p.id AS product_id, p."nameEn" AS name_en, p."nameAr" AS name_ar, p."slugEn" AS slug_en,
             count(*)::int AS clicks, bool_or(p."preorderEnabled") AS preorder
      FROM "SearchClick" sc
      JOIN "Product" p ON p.id = sc."productId"
      WHERE sc."createdAt" >= ${start} AND sc."productId" IS NOT NULL
      GROUP BY p.id, p."nameEn", p."nameAr", p."slugEn"
      HAVING coalesce((
        SELECT sum(l."qtyOnHand") FROM "Lot" l
        WHERE l."productId" = p.id AND l.status = 'LIVE' AND l."qtyOnHand" > 0
      ), 0) = 0
      ORDER BY clicks DESC
      LIMIT 50`,
    prisma.$queryRaw<Array<{ normalized: string; term: string; searches: number }>>`
      SELECT normalized,
             (array_agg(term ORDER BY "createdAt" DESC))[1] AS term,
             count(*)::int AS searches
      FROM "SearchQuery"
      WHERE "createdAt" >= ${start} AND "resultCount" = 0
      GROUP BY normalized
      ORDER BY searches DESC
      LIMIT 100`,
  ]);
  return {
    days,
    outOfStock: outOfStock.map((r) => ({ productId: r.product_id, nameEn: r.name_en, nameAr: r.name_ar, slugEn: r.slug_en, clicks: r.clicks, preorder: r.preorder })),
    zeroResult: zeroResult.map((r) => ({ term: r.term, normalized: r.normalized, searches: r.searches })),
  };
}
