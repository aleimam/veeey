import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { cardProductInclude, toCardProduct, visibleProductWhere } from '@/lib/storefront';
import { getFeaturedCollectionId } from '@/lib/home-content-service';
import { resolveCollectionProducts } from '@/lib/content-service';
import { normalizeLayout, parseLayout, type Block } from '@/lib/home-layout';
import type { Product as CardProduct } from '@/components/storefront/product-card';

/** Homepage layout persistence (JSON Setting) + product data resolution for the
 *  builder blocks. No dedicated table yet — `home.layout` mirrors theme.tokens. */

const KEY = 'home.layout';

export async function getHomeLayout(): Promise<Block[]> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: KEY } });
    if (row?.value) return normalizeLayout(JSON.parse(row.value) as Block[]);
  } catch {
    // table missing / bad JSON → defaults
  }
  return normalizeLayout(null);
}

export async function saveHomeLayout(blocks: Block[]): Promise<void> {
  const user = await requirePermission('settings.manage');
  const clean = parseLayout(blocks);
  const value = JSON.stringify(clean);
  await prisma.setting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'home.layout.update', entityType: 'Setting', entityId: KEY });
}

// ---- Product data for blocks ----------------------------------------------
async function popular(locale: string, take: number): Promise<CardProduct[]> {
  const featuredId = await getFeaturedCollectionId();
  const ids = featuredId ? (await resolveCollectionProducts(featuredId)).slice(0, take).map((p) => p.id) : [];
  const rows = ids.length
    ? await prisma.product.findMany({ where: { id: { in: ids }, status: 'PUBLISHED', AND: [visibleProductWhere] }, include: cardProductInclude })
    : await prisma.product.findMany({ where: { status: 'PUBLISHED', AND: [visibleProductWhere] }, include: cardProductInclude, orderBy: [{ ratingCount: 'desc' }, { updatedAt: 'desc' }], take });
  return rows.map((p) => toCardProduct(p, locale));
}

async function dealsProducts(locale: string, take: number): Promise<CardProduct[]> {
  const rows = await prisma.product.findMany({ where: { status: 'PUBLISHED', lots: { some: { saleFlag: true } }, AND: [visibleProductWhere] }, include: cardProductInclude, orderBy: [{ updatedAt: 'desc' }], take });
  return rows.map((p) => toCardProduct(p, locale));
}

async function newest(locale: string, take: number): Promise<CardProduct[]> {
  const rows = await prisma.product.findMany({ where: { status: 'PUBLISHED', AND: [visibleProductWhere] }, include: cardProductInclude, orderBy: { createdAt: 'desc' }, take });
  return rows.map((p) => toCardProduct(p, locale));
}

async function collectionRow(collectionId: string, locale: string, take: number): Promise<CardProduct[]> {
  const ids = (await resolveCollectionProducts(collectionId)).slice(0, take).map((p) => p.id);
  if (!ids.length) return [];
  const rows = await prisma.product.findMany({ where: { id: { in: ids }, status: 'PUBLISHED', AND: [visibleProductWhere] }, include: cardProductInclude });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p).map((p) => toCardProduct(p, locale));
}

export type HomeData = { bestsellers: CardProduct[]; deals: CardProduct[]; rows: Record<string, CardProduct[]> };

/** Resolve only the product data the enabled blocks actually need. */
export async function resolveHomeData(blocks: Block[], locale: string): Promise<HomeData> {
  const enabled = blocks.filter((b) => b.enabled);
  const needBest = enabled.some((b) => b.type === 'best-sellers' || b.type === 'hero');
  const needDeals = enabled.some((b) => b.type === 'deals');
  const [bestsellers, deals] = await Promise.all([
    needBest ? popular(locale, 8) : Promise.resolve<CardProduct[]>([]),
    needDeals ? dealsProducts(locale, 6) : Promise.resolve<CardProduct[]>([]),
  ]);
  const rows: Record<string, CardProduct[]> = {};
  for (const b of enabled.filter((x) => x.type === 'product-row')) {
    const p = (b.props ?? {}) as Record<string, unknown>;
    const source = String(p.source ?? 'bestsellers');
    const limit = Math.min(12, Math.max(1, Number(p.limit) || 5));
    if (source === 'collection' && p.collectionId) rows[b.id] = await collectionRow(String(p.collectionId), locale, limit);
    else if (source === 'deals') rows[b.id] = await dealsProducts(locale, limit);
    else if (source === 'new') rows[b.id] = await newest(locale, limit);
    else rows[b.id] = await popular(locale, limit);
  }
  return { bestsellers, deals, rows };
}
