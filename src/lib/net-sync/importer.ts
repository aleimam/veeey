/**
 * veeey.net catalog sync — IMPORTER (writes the Veeey Postgres via Prisma).
 *
 * Idempotent, keyed on `Product.legacyWpId` (= the WP post id). Safe to re-run:
 * products upsert, lots reconcile by expiry (update qty/price, create missing,
 * zero-out lots that vanished from source). Brands/categories are found-or-created
 * and deduped by slug. `dryRun` computes the full plan + summary without writing.
 *
 * This module is shared by the one-time import (Phase 1) and the 10-minute sync
 * (Phase 2) — same transform, same reconcile.
 */
import { prisma } from '@/lib/prisma';
import { ProductStatus, LotStatus } from '@/generated/prisma/client';
import { slugify } from '@/lib/sku';
import { planProduct, passesArchiveFloor, type RawProduct, type PlannedProduct } from './transform';

export type ImportSummary = {
  productsSeen: number;
  productsCreated: number;
  productsUpdated: number;
  lotsCreated: number;
  lotsUpdated: number;
  lotsZeroed: number;
  brandsCreated: number;
  categoriesCreated: number;
  liveLots: number;
  expiredLots: number;
  nonPerishableLots: number;
  totalLiveUnits: number;
  noPrice: number;
  noLiveStock: number;
  syntheticLots: number;
  errors: { wpId: number; detail: string }[];
};

const emptySummary = (): ImportSummary => ({
  productsSeen: 0, productsCreated: 0, productsUpdated: 0,
  lotsCreated: 0, lotsUpdated: 0, lotsZeroed: 0,
  brandsCreated: 0, categoriesCreated: 0,
  liveLots: 0, expiredLots: 0, nonPerishableLots: 0, totalLiveUnits: 0,
  noPrice: 0, noLiveStock: 0, syntheticLots: 0, errors: [],
});

/** Resolve (or create) the single stock location lots attach to. */
async function ensureLocation(dryRun: boolean): Promise<string> {
  const existing = await prisma.location.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });
  if (existing) return existing.id;
  if (dryRun) return 'DRY_RUN_LOCATION';
  const created = await prisma.location.create({ data: { name: 'Main Warehouse', type: 'warehouse' }, select: { id: true } });
  return created.id;
}

/** Cache of brand/category slug → id so a run creates each at most once. */
class TaxonomyCache {
  private brands = new Map<string, string>();
  private cats = new Map<string, string>();
  constructor(private dryRun: boolean, private summary: ImportSummary) {}

  async brandId(name: string | null): Promise<string | null> {
    if (!name) return null;
    const slug = slugify(name) || 'brand';
    const hit = this.brands.get(slug);
    if (hit) return hit;
    const existing = await prisma.brand.findUnique({ where: { slug }, select: { id: true } });
    if (existing) { this.brands.set(slug, existing.id); return existing.id; }
    this.summary.brandsCreated++;
    if (this.dryRun) { this.brands.set(slug, `DRY_${slug}`); return `DRY_${slug}`; }
    const created = await prisma.brand.create({ data: { slug, nameEn: name, legacyName: name }, select: { id: true } });
    this.brands.set(slug, created.id);
    return created.id;
  }

  async categoryIds(cats: { nameEn: string; slug: string }[]): Promise<string[]> {
    const ids: string[] = [];
    for (const c of cats) {
      const slug = slugify(c.slug || c.nameEn) || 'category';
      let id = this.cats.get(slug);
      if (!id) {
        const existing = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
        if (existing) id = existing.id;
        else {
          this.summary.categoriesCreated++;
          id = this.dryRun ? `DRY_${slug}` : (await prisma.category.create({ data: { slug, nameEn: c.nameEn || slug }, select: { id: true } })).id;
        }
        this.cats.set(slug, id);
      }
      ids.push(id);
    }
    return ids;
  }
}

/** A unique slug for this product, tolerating collisions with OTHER products. */
async function uniqueProductSlug(base: string, wpId: number): Promise<string> {
  const root = slugify(base) || `product-${wpId}`;
  let cand = root;
  let n = 2;
  while (true) {
    const clash = await prisma.product.findFirst({ where: { slugEn: cand, legacyWpId: { not: wpId } }, select: { id: true } });
    if (!clash) return cand;
    cand = `${root}-${n++}`;
  }
}

const lotKey = (expiry: Date | null) => (expiry ? expiry.toISOString().slice(0, 10) : 'NULL');

/** Reconcile a product's lots against the plan (match by expiry date). */
async function reconcileLots(productId: string, locationId: string, planned: PlannedProduct['lots'], dryRun: boolean, s: ImportSummary) {
  const existing = productId.startsWith('DRY_') ? [] : await prisma.lot.findMany({ where: { productId }, select: { id: true, expiryDate: true, qtyOnHand: true } });
  const byKey = new Map<string, { id: string }[]>();
  for (const l of existing) {
    const k = lotKey(l.expiryDate);
    (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(l);
  }
  const touched = new Set<string>();
  for (const lot of planned) {
    if (lot.status === 'LIVE') { s.liveLots++; s.totalLiveUnits += lot.qtyOnHand; } else s.expiredLots++;
    if (lot.expiryDate == null) s.nonPerishableLots++;
    const k = lotKey(lot.expiryDate);
    const match = byKey.get(k)?.find((m) => !touched.has(m.id));
    if (match) {
      touched.add(match.id);
      s.lotsUpdated++;
      if (!dryRun) await prisma.lot.update({ where: { id: match.id }, data: { qtyOnHand: lot.qtyOnHand, priceOverridePiastres: lot.priceOverridePiastres, status: lot.status as LotStatus } });
    } else {
      s.lotsCreated++;
      if (!dryRun) await prisma.lot.create({ data: { productId, locationId, expiryDate: lot.expiryDate, qtyOnHand: lot.qtyOnHand, priceOverridePiastres: lot.priceOverridePiastres, status: lot.status as LotStatus } });
    }
  }
  // Lots that vanished from source → zero them out (WP is the stock master).
  for (const l of existing) {
    if (!touched.has(l.id) && l.qtyOnHand !== 0) {
      s.lotsZeroed++;
      if (!dryRun) await prisma.lot.update({ where: { id: l.id }, data: { qtyOnHand: 0 } });
    }
  }
}

async function importOne(p: PlannedProduct, locationId: string, tax: TaxonomyCache, dryRun: boolean, s: ImportSummary) {
  const brandId = await tax.brandId(p.brandName);
  const categoryIds = await tax.categoryIds(p.categories);
  if (p.flags.noPrice) s.noPrice++;
  if (p.flags.noLiveStock) s.noLiveStock++;
  if (p.flags.syntheticLot) s.syntheticLots++;

  const existing = await prisma.product.findUnique({ where: { legacyWpId: p.wpId }, select: { id: true } });

  const common = {
    nameEn: p.nameEn, nameAr: p.nameAr,
    shortDescEn: p.shortDescEn, shortDescAr: p.shortDescAr,
    longDescEn: p.longDescEn, longDescAr: p.longDescAr,
    basePricePiastres: p.basePricePiastres,
    brandId, legacySku: p.legacySku,
    status: ProductStatus.PUBLISHED,
    syncedAt: new Date(),
  };

  let productId: string;
  if (existing) {
    s.productsUpdated++;
    productId = existing.id;
    if (!dryRun) await prisma.product.update({ where: { id: existing.id }, data: { ...common, categories: { set: categoryIds.map((id) => ({ id })) } } });
  } else {
    s.productsCreated++;
    const slugEn = dryRun ? p.slugEn : await uniqueProductSlug(p.slugEn, p.wpId);
    if (dryRun) {
      productId = `DRY_${p.wpId}`;
    } else {
      const created = await prisma.product.create({
        data: {
          ...common,
          sku: p.sku, legacyWpId: p.wpId, slugEn, slugAr: p.slugAr,
          kind: 'SUPPLEMENT',
          categories: { connect: categoryIds.map((id) => ({ id })) },
        },
        select: { id: true },
      });
      productId = created.id;
    }
  }
  await reconcileLots(productId, locationId, p.lots, dryRun, s);
}

export type ArchiveResult = { candidates: number; archived: number; skippedForSafety: boolean };

/**
 * Delete-detection for the 10-minute sync (WP is the master): products whose
 * `legacyWpId` is no longer in the source scan get ARCHIVED (hidden) and their
 * lots zeroed. Guarded by a safety FLOOR — if the scan returned implausibly few
 * products (e.g. a failed/partial source read), we refuse to archive, so a
 * transient error can never wipe the catalog. Only call on a FULL scan.
 */
export async function archiveVanished(seenWpIds: number[], opts: { dryRun: boolean; minSeenRatio?: number } = { dryRun: true }): Promise<ArchiveResult> {
  const seen = new Set(seenWpIds);
  const existing = await prisma.product.findMany({
    where: { legacyWpId: { not: null }, status: { not: ProductStatus.ARCHIVED } },
    select: { id: true, legacyWpId: true },
  });
  const gone = existing.filter((p) => !seen.has(p.legacyWpId!));
  // Safety: the scan must cover at least `minSeenRatio` of the live set, else bail.
  if (!passesArchiveFloor(existing.length, gone.length, opts.minSeenRatio ?? 0.5)) {
    return { candidates: gone.length, archived: 0, skippedForSafety: true };
  }
  if (!opts.dryRun) {
    for (const p of gone) {
      await prisma.product.update({ where: { id: p.id }, data: { status: ProductStatus.ARCHIVED } });
      await prisma.lot.updateMany({ where: { productId: p.id, qtyOnHand: { not: 0 } }, data: { qtyOnHand: 0 } });
    }
  }
  return { candidates: gone.length, archived: gone.length, skippedForSafety: false };
}

/** Import (or dry-run) the full catalog. */
export async function importCatalog(raws: RawProduct[], opts: { dryRun: boolean; now?: Date; onProgress?: (n: number, total: number) => void } = { dryRun: true }): Promise<ImportSummary> {
  const s = emptySummary();
  const now = opts.now ?? new Date();
  const locationId = await ensureLocation(opts.dryRun);
  const tax = new TaxonomyCache(opts.dryRun, s);

  let i = 0;
  for (const raw of raws) {
    s.productsSeen++;
    try {
      await importOne(planProduct(raw, now), locationId, tax, opts.dryRun, s);
    } catch (e) {
      s.errors.push({ wpId: raw.wpId, detail: e instanceof Error ? e.message : String(e) });
    }
    if (++i % 200 === 0) opts.onProgress?.(i, raws.length);
  }
  opts.onProgress?.(raws.length, raws.length);
  return s;
}
