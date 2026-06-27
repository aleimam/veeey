import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { cardProductInclude, toCardProduct, visibleProductWhere } from '@/lib/storefront';
import type { Product as CardProduct } from '@/components/storefront/product-card';

/** Rule-based recommenders (FR-PERS-*). Driven by recently-viewed (cookie) and
 *  purchase history (orders). All return ProductCard view models; rows render
 *  only when non-empty, with a popular-products fallback where sensible. */

export async function readRecentlyViewedIds(): Promise<string[]> {
  try {
    const c = await cookies();
    const raw = c.get('veeey-recent')?.value;
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

async function loadCards(ids: string[], locale: string): Promise<CardProduct[]> {
  if (ids.length === 0) return [];
  const products = await prisma.product.findMany({ where: { id: { in: ids }, status: 'PUBLISHED', AND: [visibleProductWhere] }, include: cardProductInclude });
  const byId = new Map(products.map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p).map((p) => toCardProduct(p, locale));
}

export async function recentlyViewed(locale: string, excludeId?: string, limit = 4): Promise<CardProduct[]> {
  const ids = (await readRecentlyViewedIds()).filter((id) => id !== excludeId).slice(0, limit);
  return loadCards(ids, locale);
}

export async function buyAgain(customerId: string, locale: string, limit = 4): Promise<CardProduct[]> {
  const items = await prisma.orderItem.findMany({ where: { order: { customerId } }, select: { productId: true }, orderBy: { id: 'desc' }, take: 60 });
  const ids = [...new Set(items.map((i) => i.productId))].slice(0, limit);
  return loadCards(ids, locale);
}

async function popularIds(limit: number): Promise<string[]> {
  const pop = await prisma.product.findMany({ where: { status: 'PUBLISHED', AND: [visibleProductWhere] }, orderBy: [{ ratingCount: 'desc' }, { updatedAt: 'desc' }], take: limit, select: { id: true } });
  return pop.map((p) => p.id);
}

export async function popularInTier(tierId: string | null, locale: string, limit = 4): Promise<CardProduct[]> {
  let ids: string[] = [];
  if (tierId) {
    const orders = await prisma.order.findMany({ where: { customer: { tierId } }, select: { id: true }, take: 500 });
    if (orders.length) {
      const grp = await prisma.orderItem.groupBy({ by: ['productId'], where: { orderId: { in: orders.map((o) => o.id) } }, _sum: { qty: true }, orderBy: { _sum: { qty: 'desc' } }, take: limit });
      ids = grp.map((g) => g.productId);
    }
  }
  if (ids.length === 0) ids = await popularIds(limit);
  return loadCards(ids, locale);
}

export async function recommendedForYou(locale: string, limit = 4): Promise<CardProduct[]> {
  const recent = await readRecentlyViewedIds();
  let ids: string[] = [];
  if (recent.length) {
    const cats = await prisma.product.findMany({ where: { id: { in: recent } }, select: { categories: { select: { id: true } } } });
    const catIds = [...new Set(cats.flatMap((c) => c.categories.map((x) => x.id)))];
    if (catIds.length) {
      const inCat = await prisma.product.findMany({ where: { status: 'PUBLISHED', id: { notIn: recent }, categories: { some: { id: { in: catIds } } }, AND: [visibleProductWhere] }, orderBy: { ratingCount: 'desc' }, take: limit, select: { id: true } });
      ids = inCat.map((p) => p.id);
    }
  }
  if (ids.length === 0) ids = await popularIds(limit);
  return loadCards(ids, locale);
}

export async function frequentlyBoughtTogether(productId: string, locale: string, limit = 4): Promise<CardProduct[]> {
  const orderIds = (await prisma.orderItem.findMany({ where: { productId }, select: { orderId: true }, take: 500 })).map((o) => o.orderId);
  if (orderIds.length === 0) return [];
  const grp = await prisma.orderItem.groupBy({ by: ['productId'], where: { orderId: { in: orderIds }, productId: { not: productId } }, _sum: { qty: true }, orderBy: { _sum: { qty: 'desc' } }, take: limit });
  return loadCards(grp.map((g) => g.productId), locale);
}

/** Category affinity for personalized search ranking (FR-PERS-03). */
export async function affinityCategoryIds(): Promise<Set<string>> {
  const recent = await readRecentlyViewedIds();
  if (recent.length === 0) return new Set();
  const cats = await prisma.product.findMany({ where: { id: { in: recent } }, select: { categories: { select: { id: true } } } });
  return new Set(cats.flatMap((c) => c.categories.map((x) => x.id)));
}
