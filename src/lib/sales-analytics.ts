import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { getNumberSetting } from '@/lib/settings-service';
import { periodRange, bucketByValue, bucketLabels, salesTrend, trendGrain, LIFETIME_EDGES, NON_BOOKED_STATUSES, type Metrics, type PeriodPreset, type Range, type Bucket, type TrendPoint, type TrendGrain } from '@/lib/sales-analytics-core';

/**
 * Sales & customer analytics (period compare, segments, distributions).
 * "Orders/revenue" = orders PLACED in the window, excluding cancelled-like
 * statuses (gross bookings). Pure helpers live in sales-analytics-core.
 */
export type { PeriodPreset, Range, Metrics, Bucket } from '@/lib/sales-analytics-core';
export { periodRange, bucketByValue } from '@/lib/sales-analytics-core';

// Cancelled/failed orders don't count toward bookings. Shared with the Orders
// list's `booked` filter so the two pages agree (V6 audit S4).
const EXCLUDED = NON_BOOKED_STATUSES;

const metricsOf = (orders: { totalPiastres: bigint }[]): Metrics => {
  const count = orders.length;
  const revenue = orders.reduce((s, o) => s + Number(o.totalPiastres), 0);
  return { count, revenue, aov: count ? Math.round(revenue / count) : 0 };
};

export type TopSeller = { id: string; nameEn: string; nameAr: string | null; revenue: number; units: number };

/**
 * Best-selling products and brands in the window (V6 audit S10).
 *
 * ⚠️ Basis: this sums ORDER LINES (qty × unit price, excluding lines marked
 * lost), so it will NOT add up to the period card's revenue — that counts whole
 * order totals, which also carry shipping and order-level discounts. The panel
 * says so on screen; see the note in the Sales page.
 *
 * Raw SQL because the revenue is a product of two columns, which Prisma's
 * groupBy cannot sum. Column names are the real ones: Order.placedAt (NOT
 * createdAt — assuming otherwise 500'd the search analytics in V5 F1).
 */
export async function topSellers(range: Range, limit = 10): Promise<{ products: TopSeller[]; brands: TopSeller[] }> {
  const rows = async (groupCol: Prisma.Sql, extra: Prisma.Sql) =>
    prisma.$queryRaw<{ id: string; revenue: bigint; units: number }[]>`
      SELECT ${groupCol} AS id,
             SUM(oi.qty * oi."unitPricePiastres")::bigint AS revenue,
             SUM(oi.qty)::int AS units
      FROM "OrderItem" oi
      JOIN "Order" o ON o.id = oi."orderId"
      ${extra}
      WHERE o."placedAt" >= ${range.start}
        AND o."placedAt" <= ${range.end}
        AND o.status NOT IN (${Prisma.join(NON_BOOKED_STATUSES)})
        AND oi.lost = false
        AND ${groupCol} IS NOT NULL
      GROUP BY ${groupCol}
      ORDER BY revenue DESC
      LIMIT ${limit}
    `;

  const [prodRows, brandRows] = await Promise.all([
    rows(Prisma.sql`oi."productId"`, Prisma.empty),
    rows(Prisma.sql`p."brandId"`, Prisma.sql`JOIN "Product" p ON p.id = oi."productId"`),
  ]);

  const [products, brands] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: prodRows.map((r) => r.id) } }, select: { id: true, nameEn: true, nameAr: true } }),
    prisma.brand.findMany({ where: { id: { in: brandRows.map((r) => r.id) } }, select: { id: true, nameEn: true, nameAr: true } }),
  ]);

  // Re-join in SQL's order — findMany returns its own, and re-sorting by revenue
  // in JS would silently disagree with the LIMIT the DB applied.
  const merge = (agg: { id: string; revenue: bigint; units: number }[], names: { id: string; nameEn: string; nameAr: string | null }[]): TopSeller[] => {
    const byId = new Map(names.map((n) => [n.id, n]));
    return agg.map((r) => ({
      id: r.id,
      nameEn: byId.get(r.id)?.nameEn ?? r.id,
      nameAr: byId.get(r.id)?.nameAr ?? null,
      revenue: Number(r.revenue),
      units: Number(r.units),
    }));
  };
  return { products: merge(prodRows, products), brands: merge(brandRows, brands) };
}

/**
 * The window a selection resolves to, without touching the DB. Lets the page
 * label the range and render the filter while the numbers are still loading
 * (V6 audit S12) — the pure math is the same one `salesAnalytics` uses.
 */
export const salesPeriodRange = (preset: PeriodPreset, from?: string, to?: string): Range =>
  periodRange(preset, from, to, new Date());

export type SalesAnalytics = {
  range: Range;
  current: Metrics; previous: Metrics;
  newSeg: Metrics; repeatSeg: Metrics;
  bigSeg: Metrics; normalSeg: Metrics;
  bigThresholdEgp: number;
  orderValueHist: Bucket[];
  lifetimeHist: Bucket[];
  trend: TrendPoint[]; trendGrain: TrendGrain;
};

export async function salesAnalytics(preset: PeriodPreset, from?: string, to?: string): Promise<SalesAnalytics> {
  const now = new Date();
  const range = periodRange(preset, from, to, now);
  const bigThresholdEgp = await getNumberSetting('analytics.bigOrderEgp');
  const bigThreshold = BigInt(Math.round(bigThresholdEgp * 100));
  const where = (start: Date, end: Date) => ({ placedAt: { gte: start, lte: end }, status: { notIn: EXCLUDED } });

  const [cur, prev] = await Promise.all([
    // placedAt rides along for the trend (S10) — the trend is bucketed from the
    // very same rows the cards count, so the two can't tell different stories.
    prisma.order.findMany({ where: where(range.start, range.end), select: { totalPiastres: true, customerId: true, placedAt: true } }),
    prisma.order.findMany({ where: where(range.prevStart, range.prevEnd), select: { totalPiastres: true } }),
  ]);

  // New vs repeat: a customer is "repeat" if they ordered before the window.
  const custIds = [...new Set(cur.map((o) => o.customerId).filter((x): x is string => !!x))];
  const priorBuyers = custIds.length
    ? await prisma.order.findMany({ where: { placedAt: { lt: range.start }, customerId: { in: custIds }, status: { notIn: EXCLUDED } }, distinct: ['customerId'], select: { customerId: true } })
    : [];
  const repeatSet = new Set(priorBuyers.map((o) => o.customerId));
  const repeatOrders = cur.filter((o) => o.customerId && repeatSet.has(o.customerId));
  const newOrders = cur.filter((o) => !(o.customerId && repeatSet.has(o.customerId))); // guests + first-time buyers

  const bigOrders = cur.filter((o) => o.totalPiastres >= bigThreshold);
  const normalOrders = cur.filter((o) => o.totalPiastres < bigThreshold);

  // Customer lifetime-spend distribution (snapshot across all customers).
  const lifetimeCounts = await Promise.all(
    LIFETIME_EDGES.map((lo, i) => {
      const hi = LIFETIME_EDGES[i + 1];
      return prisma.customer.count({ where: { lifetimeSpendPiastres: { gte: BigInt(lo), ...(hi ? { lt: BigInt(hi) } : {}) } } });
    }),
  );
  const lifetimeHist = bucketLabels(LIFETIME_EDGES).map((label, i) => ({ label, count: lifetimeCounts[i] }));

  const grain = trendGrain(range.start, range.end);

  return {
    range,
    current: metricsOf(cur), previous: metricsOf(prev),
    newSeg: metricsOf(newOrders), repeatSeg: metricsOf(repeatOrders),
    bigSeg: metricsOf(bigOrders), normalSeg: metricsOf(normalOrders),
    bigThresholdEgp,
    orderValueHist: bucketByValue(cur.map((o) => Number(o.totalPiastres))),
    lifetimeHist,
    trend: salesTrend(cur.map((o) => ({ placedAt: o.placedAt, totalPiastres: Number(o.totalPiastres) })), range.start, range.end, grain),
    trendGrain: grain,
  };
}
