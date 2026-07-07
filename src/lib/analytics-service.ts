import { prisma } from '@/lib/prisma';
import { deriveSourceKey, SOURCE_KEYS, type Attribution, type SourceKey } from '@/lib/attribution';

/** Behavioral analytics from the first-party clickstream + orders (FR-ANL-*). */
const sinceDate = (days: number) => new Date(Date.now() - days * 86_400_000);

/**
 * Traffic-sources report (owner batch #7): orders bucketed by the derived
 * attribution source (Order.utmJson), with delivered revenue per bucket.
 */
export async function ordersBySource(days = 30) {
  const rows = await prisma.order.findMany({
    where: { placedAt: { gte: sinceDate(days) } },
    select: { utmJson: true, totalPiastres: true, status: true },
  });
  const buckets = new Map<SourceKey, { orders: number; revenue: number }>(SOURCE_KEYS.map((k) => [k, { orders: 0, revenue: 0 }]));
  for (const o of rows) {
    const b = buckets.get(deriveSourceKey(o.utmJson as Attribution | null))!;
    b.orders += 1;
    if (o.status === 'DELIVERED') b.revenue += Number(o.totalPiastres);
  }
  return SOURCE_KEYS.map((key) => ({ key, ...buckets.get(key)! })).sort((a, b) => b.orders - a.orders);
}

export async function funnelCounts(days = 30) {
  const since = sinceDate(days);
  // Event names must match the emitted clickstream vocabulary (events.ts):
  // add_to_cart (buy box) and checkout_step (checkout page). The "orders" stage
  // counts storefront (DIRECT) orders only, so the funnel measures the web
  // journey — comparable to the clickstream stages, not polluted by manual /
  // migrated / phone orders that never touched the funnel.
  const [views, carts, checkouts, orders] = await Promise.all([
    prisma.analyticsEvent.count({ where: { type: 'product_view', createdAt: { gte: since } } }),
    prisma.analyticsEvent.count({ where: { type: 'add_to_cart', createdAt: { gte: since } } }),
    prisma.analyticsEvent.count({ where: { type: 'checkout_step', createdAt: { gte: since } } }),
    prisma.order.count({ where: { placedAt: { gte: since }, source: 'DIRECT' } }),
  ]);
  return { views, carts, checkouts, orders };
}

export async function topSearches(limit = 10, days = 30) {
  const events = await prisma.analyticsEvent.findMany({ where: { type: 'search', createdAt: { gte: sinceDate(days) } }, select: { propsJson: true }, take: 5000 });
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
  return [...tally.entries()].map(([q, v]) => ({ q, ...v })).sort((a, b) => b.count - a.count).slice(0, limit);
}

export async function topViewedProducts(limit = 10, days = 30) {
  const events = await prisma.analyticsEvent.findMany({ where: { type: 'product_view', createdAt: { gte: sinceDate(days) } }, select: { propsJson: true }, take: 10000 });
  const tally = new Map<string, number>();
  for (const e of events) {
    const sku = (e.propsJson as { sku?: string } | null)?.sku;
    if (sku) tally.set(sku, (tally.get(sku) ?? 0) + 1);
  }
  const top = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  const products = await prisma.product.findMany({ where: { sku: { in: top.map(([sku]) => sku) } }, select: { sku: true, nameEn: true } });
  const nameBy = new Map(products.map((p) => [p.sku, p.nameEn]));
  return top.map(([sku, views]) => ({ sku, name: nameBy.get(sku) ?? sku, views }));
}

export async function kpis(days = 30) {
  const since = sinceDate(days);
  const [delivered, orders, customers] = await Promise.all([
    prisma.order.aggregate({ where: { status: 'DELIVERED', placedAt: { gte: since } }, _sum: { totalPiastres: true }, _count: true }),
    prisma.order.count({ where: { placedAt: { gte: since } } }),
    prisma.customer.count(),
  ]);
  const revenue = Number(delivered._sum.totalPiastres ?? 0n);
  return { revenue, deliveredOrders: delivered._count, orders, customers, aov: delivered._count > 0 ? Math.round(revenue / delivered._count) : 0 };
}

const DELIVERED = ['DELIVERED'] as const;

/**
 * Extended commerce metrics for the analytics page (FR-ANL-*).
 * - aov: revenue / order count over the window (delivered orders)
 * - conversionRate: orders / analytics sessions over the window (null if no sessions)
 * - repeatPurchaseRate: share of customers with >1 delivered order (all-time)
 * - revenueByMonth: last `months` calendar months of delivered revenue (piastres)
 * - bestSellers: top products by units sold over the window
 */
export async function commerceMetrics({ days = 30, months = 6, sellersLimit = 8 } = {}) {
  const since = sinceDate(days);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const [delivered, orderCount, webOrders, sessions, deliveredOrdersForRepeat, monthRows, sellerRows] = await Promise.all([
    prisma.order.aggregate({ where: { status: { in: [...DELIVERED] }, placedAt: { gte: since } }, _sum: { totalPiastres: true }, _count: true }),
    prisma.order.count({ where: { placedAt: { gte: since } } }),
    prisma.order.count({ where: { placedAt: { gte: since }, source: 'DIRECT' } }), // storefront orders — comparable to web sessions
    prisma.analyticsSession.count({ where: { startedAt: { gte: since } } }),
    prisma.order.groupBy({ by: ['customerId'], where: { status: { in: [...DELIVERED] }, customerId: { not: null } }, _count: { _all: true } }),
    prisma.order.findMany({ where: { status: { in: [...DELIVERED] }, placedAt: { gte: monthStart } }, select: { placedAt: true, totalPiastres: true } }),
    prisma.orderItem.groupBy({ by: ['productId'], where: { order: { placedAt: { gte: since } } }, _sum: { qty: true }, orderBy: { _sum: { qty: 'desc' } }, take: sellersLimit }),
  ]);

  const revenue = Number(delivered._sum.totalPiastres ?? 0n);
  const aov = delivered._count > 0 ? Math.round(revenue / delivered._count) : 0;
  // Conversion = storefront orders ÷ sessions, clamped to ≤100% (a session can
  // yield multiple orders, and off-session orders exist, so the raw ratio can
  // exceed 1 — never show >100%).
  const conversionRate = sessions > 0 ? Math.min(1, webOrders / sessions) : null;

  const buyers = deliveredOrdersForRepeat.length;
  const repeatBuyers = deliveredOrdersForRepeat.filter((c) => c._count._all > 1).length;
  const repeatPurchaseRate = buyers > 0 ? repeatBuyers / buyers : null;

  // Build a fixed list of the last `months` months, summing delivered revenue into each.
  const monthBuckets = Array.from({ length: months }, (_, i) => {
    const d = new Date(monthStart.getFullYear(), monthStart.getMonth() + i, 1);
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, year: d.getFullYear(), month: d.getMonth(), revenue: 0 };
  });
  const bucketByKey = new Map(monthBuckets.map((b) => [b.key, b]));
  for (const o of monthRows) {
    const key = `${o.placedAt.getFullYear()}-${String(o.placedAt.getMonth() + 1).padStart(2, '0')}`;
    const b = bucketByKey.get(key);
    if (b) b.revenue += Number(o.totalPiastres);
  }

  const sellerProducts = await prisma.product.findMany({ where: { id: { in: sellerRows.map((r) => r.productId) } }, select: { id: true, sku: true, nameEn: true, nameAr: true } });
  const sellerById = new Map(sellerProducts.map((p) => [p.id, p]));
  const bestSellers = sellerRows.map((r) => {
    const p = sellerById.get(r.productId);
    return { id: r.productId, sku: p?.sku ?? r.productId, nameEn: p?.nameEn ?? r.productId, nameAr: p?.nameAr ?? null, qty: r._sum.qty ?? 0 };
  });

  return { revenue, deliveredOrders: delivered._count, orders: orderCount, sessions, aov, conversionRate, repeatPurchaseRate, revenueByMonth: monthBuckets, bestSellers };
}
