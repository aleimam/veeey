import { prisma } from '@/lib/prisma';

/** Behavioral analytics from the first-party clickstream + orders (FR-ANL-*). */
const sinceDate = (days: number) => new Date(Date.now() - days * 86_400_000);

export async function funnelCounts(days = 30) {
  const since = sinceDate(days);
  const [views, carts, checkouts, orders] = await Promise.all([
    prisma.analyticsEvent.count({ where: { type: 'product_view', createdAt: { gte: since } } }),
    prisma.analyticsEvent.count({ where: { type: 'cart_add', createdAt: { gte: since } } }),
    prisma.analyticsEvent.count({ where: { type: { in: ['checkout_start', 'begin_checkout', 'checkout'] }, createdAt: { gte: since } } }),
    prisma.order.count({ where: { placedAt: { gte: since } } }),
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
    prisma.order.aggregate({ where: { status: { in: ['CASH_DELIVERED', 'CARD_DELIVERED'] }, placedAt: { gte: since } }, _sum: { totalPiastres: true }, _count: true }),
    prisma.order.count({ where: { placedAt: { gte: since } } }),
    prisma.customer.count(),
  ]);
  const revenue = Number(delivered._sum.totalPiastres ?? 0n);
  return { revenue, deliveredOrders: delivered._count, orders, customers, aov: delivered._count > 0 ? Math.round(revenue / delivered._count) : 0 };
}
