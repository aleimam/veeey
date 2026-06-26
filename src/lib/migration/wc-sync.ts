import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { wooFetch } from '@/lib/woocommerce';
import { slugify, brandCode, skuFromParts } from '@/lib/sku';

/**
 * WooCommerce → Veeey live sync (egyptvitamins.com). Incremental, idempotent
 * upserts keyed on `legacyWpId`, with a `modified_after` cursor per entity.
 * Conflict policy = "protect Veeey edits": a record syncs until it is edited in
 * Veeey (its `updatedAt` drifts past the last `syncedAt`), then it detaches and
 * sync skips it. New products land as PRIVATE/draft for review. settings.manage.
 *
 * Phase 1: products only. Customers + orders, the scheduler, and webhooks follow.
 */

export type SyncSummary = {
  entity: string;
  scanned: number;
  created: number;
  updated: number;
  detached: number;
  errors: number;
  sampleErrors: { key: string; detail: string }[];
  cursor: string | null;
};

const str = (v: unknown): string => (v == null ? '' : typeof v === 'object' ? '' : String(v));
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});

const DETACH_MS = 3000; // updatedAt drift beyond this past syncedAt = locally edited → skip

function egpToPiastres(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

async function findOrCreateBrand(name: string): Promise<string | null> {
  const n = name.trim();
  if (!n) return null;
  const slug = slugify(n) || 'brand';
  const existing = await prisma.brand.findUnique({ where: { slug }, select: { id: true } });
  if (existing) return existing.id;
  const b = await prisma.brand.create({ data: { slug, nameEn: n, legacyName: n } });
  return b.id;
}

async function findOrCreateCategory(name: string, wcSlug: string): Promise<string | null> {
  const n = name.trim();
  if (!n) return null;
  const slug = (wcSlug || slugify(n)) || 'category';
  const existing = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
  if (existing) return existing.id;
  const c = await prisma.category.create({ data: { slug, nameEn: n } });
  return c.id;
}

/** Brand from native WC Brands (9.6+) or a "Brand"/"العلامة" attribute. */
function extractBrand(p: Record<string, unknown>): string {
  const brands = arr(p.brands);
  if (brands.length) return str(obj(brands[0]).name);
  for (const a of arr(p.attributes)) {
    const ao = obj(a);
    const nm = str(ao.name).toLowerCase();
    if (nm.includes('brand') || str(ao.name).includes('علامة')) {
      const opts = arr(ao.options);
      if (opts.length) return str(opts[0]);
    }
  }
  return '';
}

async function uniqueSlug(base: string, wpId: number): Promise<string> {
  const slug = slugify(base) || `product-${wpId}`;
  const clash = await prisma.product.findFirst({ where: { slugEn: slug, legacyWpId: { not: wpId } }, select: { id: true } });
  return clash ? `${slug}-${wpId}` : slug;
}

function imagesData(productId: string, p: Record<string, unknown>) {
  return arr(p.images)
    .slice(0, 12)
    .map((im, i) => ({ productId, url: str(obj(im).src), alt: str(obj(im).alt) || null, sortOrder: i, isPrimary: i === 0 }))
    .filter((x) => x.url);
}

export async function syncProducts(opts: { maxPages?: number; perPage?: number } = {}): Promise<SyncSummary> {
  const user = await requirePermission('settings.manage');
  const maxPages = Math.min(opts.maxPages ?? 5, 50);
  const perPage = opts.perPage ?? 50;

  const state = await prisma.wooSyncState.findUnique({ where: { entity: 'products' } });
  const cursor = state?.cursor ?? null;
  const summary: SyncSummary = { entity: 'products', scanned: 0, created: 0, updated: 0, detached: 0, errors: 0, sampleErrors: [], cursor };
  let newCursor = cursor;

  const baseParams: Record<string, string | number> = { per_page: perPage, orderby: 'modified', order: 'asc' };
  if (cursor) baseParams.modified_after = cursor;

  let page = 1;
  let totalPages = 1;
  while (page <= Math.min(maxPages, totalPages)) {
    const res = await wooFetch('products', { ...baseParams, page });
    totalPages = res.totalPages;
    const items = res.data as Record<string, unknown>[];
    if (items.length === 0) break;

    for (const p of items) {
      summary.scanned++;
      const wpId = Number(p.id);
      const modified = str(p.date_modified_gmt) || str(p.date_modified);
      if (modified && (!newCursor || modified > newCursor)) newCursor = modified;

      try {
        const price = egpToPiastres(p.regular_price ?? p.price);
        if (!Number.isFinite(wpId) || price == null) {
          summary.errors++;
          if (summary.sampleErrors.length < 10) summary.sampleErrors.push({ key: str(p.id), detail: 'invalid id / price' });
          continue;
        }

        const existing = await prisma.product.findUnique({ where: { legacyWpId: wpId }, select: { id: true, syncedAt: true, updatedAt: true } });
        if (existing?.syncedAt && existing.updatedAt.getTime() - existing.syncedAt.getTime() > DETACH_MS) {
          summary.detached++;
          continue;
        }

        const brandName = extractBrand(p);
        const brandId = await findOrCreateBrand(brandName);
        const catIds: string[] = [];
        for (const c of arr(p.categories).slice(0, 4)) {
          const id = await findOrCreateCategory(str(obj(c).name), str(obj(c).slug));
          if (id) catIds.push(id);
        }
        const wKg = Number(p.weight);
        const weightG = str(p.weight) !== '' && Number.isFinite(wKg) ? Math.round(wKg * 1000) : null; // ⚠ assumes WC weight unit = kg

        const common = {
          nameEn: str(p.name) || `Product ${wpId}`,
          longDescEn: str(p.description) || null,
          shortDescEn: str(p.short_description) || null,
          basePricePiastres: BigInt(price),
          weightG,
          gtin: str(p.global_unique_id) || null,
          brandId,
          syncedAt: new Date(),
        };

        if (existing) {
          await prisma.product.update({ where: { id: existing.id }, data: { ...common, categories: { set: catIds.map((id) => ({ id })) } } });
          await prisma.productImage.deleteMany({ where: { productId: existing.id } });
          const imgs = imagesData(existing.id, p);
          if (imgs.length) await prisma.productImage.createMany({ data: imgs });
          summary.updated++;
        } else {
          const slugEn = await uniqueSlug(str(p.name), wpId);
          const created = await prisma.product.create({
            data: {
              ...common,
              sku: skuFromParts(brandCode(brandName || 'GEN'), wpId),
              legacyWpId: wpId,
              legacySku: str(p.sku) || null,
              slugEn,
              status: 'PRIVATE',
              kind: 'SUPPLEMENT',
              categories: { connect: catIds.map((id) => ({ id })) },
            },
            select: { id: true },
          });
          const imgs = imagesData(created.id, p);
          if (imgs.length) await prisma.productImage.createMany({ data: imgs });
          summary.created++;
        }
      } catch (e) {
        summary.errors++;
        if (summary.sampleErrors.length < 10) summary.sampleErrors.push({ key: str(p.id), detail: e instanceof Error ? e.message.slice(0, 140) : 'error' });
      }
    }
    page++;
  }

  summary.cursor = newCursor;
  const result = { scanned: summary.scanned, created: summary.created, updated: summary.updated, detached: summary.detached, errors: summary.errors, at: new Date().toISOString() };
  await prisma.wooSyncState.upsert({
    where: { entity: 'products' },
    update: { cursor: newCursor, lastRunAt: new Date(), lastResult: result },
    create: { entity: 'products', cursor: newCursor, lastRunAt: new Date(), lastResult: result },
  });
  await audit({ actorType: 'USER', actorId: user.id, action: 'woo.sync.products', entityType: 'WooSyncState', entityId: 'products' });
  return summary;
}

export async function getSyncState(entity: string) {
  return prisma.wooSyncState.findUnique({ where: { entity } });
}
