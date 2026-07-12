import { prisma } from '@/lib/prisma';
import { getNumberSetting } from '@/lib/settings-service';
import { periodRange, bucketByValue, bucketLabels, LIFETIME_EDGES, type Metrics, type PeriodPreset, type Range, type Bucket } from '@/lib/sales-analytics-core';

/**
 * Sales & customer analytics (period compare, segments, distributions).
 * "Orders/revenue" = orders PLACED in the window, excluding cancelled-like
 * statuses (gross bookings). Pure helpers live in sales-analytics-core.
 */
export type { PeriodPreset, Range, Metrics, Bucket } from '@/lib/sales-analytics-core';
export { periodRange, bucketByValue } from '@/lib/sales-analytics-core';

// Cancelled/failed orders don't count toward bookings.
const EXCLUDED = ['CANCELLED', 'CANCELED', 'REFUNDED', 'RETURNED', 'FAILED', 'VOID'];

const metricsOf = (orders: { totalPiastres: bigint }[]): Metrics => {
  const count = orders.length;
  const revenue = orders.reduce((s, o) => s + Number(o.totalPiastres), 0);
  return { count, revenue, aov: count ? Math.round(revenue / count) : 0 };
};

export type SalesAnalytics = {
  range: Range;
  current: Metrics; previous: Metrics;
  newSeg: Metrics; repeatSeg: Metrics;
  bigSeg: Metrics; normalSeg: Metrics;
  bigThresholdEgp: number;
  orderValueHist: Bucket[];
  lifetimeHist: Bucket[];
};

export async function salesAnalytics(preset: PeriodPreset, from?: string, to?: string): Promise<SalesAnalytics> {
  const now = new Date();
  const range = periodRange(preset, from, to, now);
  const bigThresholdEgp = await getNumberSetting('analytics.bigOrderEgp');
  const bigThreshold = BigInt(Math.round(bigThresholdEgp * 100));
  const where = (start: Date, end: Date) => ({ placedAt: { gte: start, lte: end }, status: { notIn: EXCLUDED } });

  const [cur, prev] = await Promise.all([
    prisma.order.findMany({ where: where(range.start, range.end), select: { totalPiastres: true, customerId: true } }),
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

  return {
    range,
    current: metricsOf(cur), previous: metricsOf(prev),
    newSeg: metricsOf(newOrders), repeatSeg: metricsOf(repeatOrders),
    bigSeg: metricsOf(bigOrders), normalSeg: metricsOf(normalOrders),
    bigThresholdEgp,
    orderValueHist: bucketByValue(cur.map((o) => Number(o.totalPiastres))),
    lifetimeHist,
  };
}
