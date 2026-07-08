import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { egpToPiastres } from '@/lib/format';
import { parseExpiryCell } from '@/lib/go-live-parse';

export { parseExpiryCell } from '@/lib/go-live-parse';

/**
 * Catalog go-live (post-migration). Imported products land PRIVATE with zero
 * stock (WooCommerce's API never carried lots/expiry). This module gets them
 * sale-ready: a readiness view (priced + has image), a bulk stock importer
 * (creates LIVE lots), and a guarded "publish ready" that flips every priced +
 * imaged product. Stock is NOT a publish gate — storefront visibility hides an
 * out-of-stock product unless it is in stock or flagged pre-order
 * (`visibleProductWhere`). `missingStock` stays as an informational count.
 * SKU is the canonical key.
 */

const PRELIVE = ['PRIVATE', 'DRAFT'] as const;
const inStockLot = { status: 'LIVE' as const, qtyOnHand: { gt: 0 } };

export type GoLiveCounts = { preLive: number; published: number; ready: number; missingStock: number; missingPrice: number; missingImage: number };

export async function goLiveCounts(): Promise<GoLiveCounts> {
  const pre = { status: { in: [...PRELIVE] } };
  const [preLive, published, ready, missingStock, missingPrice, missingImage] = await Promise.all([
    prisma.product.count({ where: pre }),
    prisma.product.count({ where: { status: 'PUBLISHED' } }),
    prisma.product.count({ where: { ...pre, basePricePiastres: { gt: 0 }, images: { some: {} } } }),
    prisma.product.count({ where: { ...pre, lots: { none: inStockLot } } }),
    prisma.product.count({ where: { ...pre, basePricePiastres: { lte: 0 } } }),
    prisma.product.count({ where: { ...pre, images: { none: {} } } }),
  ]);
  return { preLive, published, ready, missingStock, missingPrice, missingImage };
}

export type GoLiveRow = {
  id: string; sku: string; nameEn: string; nameAr: string | null; status: string;
  pricePiastres: bigint; images: number; inStock: boolean; ready: boolean;
};

/** Shared where-builder for the go-live list/count. `only` filters:
 *  stock/price/image (missing X), ready (publishable now), published. */
function goLiveWhere(opts: { q?: string; only?: string }) {
  return {
    ...(opts.only === 'published' ? { status: 'PUBLISHED' as const } : { status: { in: [...PRELIVE] } }),
    ...(opts.q ? { OR: [{ nameEn: { contains: opts.q, mode: 'insensitive' as const } }, { sku: { contains: opts.q, mode: 'insensitive' as const } }] } : {}),
    ...(opts.only === 'stock' ? { lots: { none: inStockLot } } : {}),
    ...(opts.only === 'price' ? { basePricePiastres: { lte: 0n } } : {}),
    ...(opts.only === 'image' ? { images: { none: {} } } : {}),
    ...(opts.only === 'ready' ? { basePricePiastres: { gt: 0n }, images: { some: {} } } : {}),
  };
}

export async function listGoLiveProducts(opts: { q?: string; only?: string; skip?: number; take?: number } = {}): Promise<GoLiveRow[]> {
  const rows = await prisma.product.findMany({
    where: goLiveWhere(opts),
    select: {
      id: true, sku: true, nameEn: true, nameAr: true, status: true, basePricePiastres: true,
      _count: { select: { images: true } },
      lots: { where: inStockLot, select: { id: true }, take: 1 },
    },
    orderBy: { nameEn: 'asc' },
    skip: opts.skip ?? 0,
    take: opts.take ?? 50,
  });
  return rows.map((p) => {
    const inStock = p.lots.length > 0;
    const ready = p.basePricePiastres > 0n && p._count.images > 0;
    return { id: p.id, sku: p.sku, nameEn: p.nameEn, nameAr: p.nameAr, status: p.status, pricePiastres: p.basePricePiastres, images: p._count.images, inStock, ready };
  });
}

export function countGoLiveProducts(opts: { q?: string; only?: string } = {}) {
  return prisma.product.count({ where: goLiveWhere(opts) });
}

/** Not-live products with no live stock — rows for the stock-import CSV template. */
export async function notStockedProducts(): Promise<{ sku: string; legacySku: string | null; legacyWpId: number | null; nameEn: string }[]> {
  return prisma.product.findMany({
    where: { status: { in: [...PRELIVE] }, lots: { none: inStockLot } },
    select: { sku: true, legacySku: true, legacyWpId: true, nameEn: true },
    orderBy: { nameEn: 'asc' },
  });
}

// ---- Stock loading (creates LIVE lots) -------------------------------------
/** Resolve a product by ANY identifier: Veeey SKU, Egypt Vitamins SKU (legacySku),
 *  or the EV/WordPress product id (legacyWpId, numeric). Lets a stock sheet keyed
 *  by the old EV SKU/ID match the re-keyed Veeey catalog. */
async function resolveProductId(key: string): Promise<string | null> {
  const k = key.trim();
  if (!k) return null;
  const bySku = await prisma.product.findUnique({ where: { sku: k }, select: { id: true } });
  if (bySku) return bySku.id;
  const byLegacy = await prisma.product.findFirst({ where: { legacySku: k }, select: { id: true } });
  if (byLegacy) return byLegacy.id;
  const n = Number(k);
  if (Number.isInteger(n) && n > 0) {
    const byWp = await prisma.product.findUnique({ where: { legacyWpId: n }, select: { id: true } });
    if (byWp) return byWp.id;
  }
  return null;
}

async function defaultLocationId(): Promise<string | null> {
  const main = await prisma.location.findUnique({ where: { id: 'loc_main' } }).catch(() => null);
  if (main) return main.id;
  return (await prisma.location.findFirst({ select: { id: true } }))?.id ?? null;
}

type StockLot = { productId: string; qty: number; expiryDate: Date | null; priceEgp?: number | null; locationId: string; saleFlag?: boolean; batch?: string | null };

/** Create one LIVE lot (go-live bulk load bypasses quarantine). No permission check — callers gate. */
async function createStockLot(it: StockLot) {
  const wasOutOfStock = (await prisma.lot.count({ where: { productId: it.productId, ...inStockLot } })) === 0;
  const lot = await prisma.lot.create({
    data: {
      productId: it.productId, locationId: it.locationId, qtyOnHand: it.qty, status: 'LIVE',
      expiryDate: it.expiryDate,
      priceOverridePiastres: it.priceEgp != null ? egpToPiastres(it.priceEgp) : null,
      saleFlag: !!it.saleFlag,
      sourceBatchId: it.batch || null,
    },
    select: { id: true },
  });
  await prisma.movementLedger.create({ data: { lotId: lot.id, locationId: it.locationId, type: 'STOCK_IN', qtyDelta: it.qty, refType: 'go-live' } });
  if (wasOutOfStock) await prisma.productChangeEvent.create({ data: { productId: it.productId, type: 'BACK_IN_STOCK' } });
}

export type StockImportReport = { created: number; skipped: number; invalid: { row: number; reason: string }[] };

/**
 * Bulk stock import. Columns: sku (req — Veeey SKU / EV SKU / EV id), qty (req >0),
 * expiry (blank/NA = none; accepts ISO or day-first DD-MM-YYYY), price (optional
 * per-lot EGP override), location (optional id OR name — created if new; blank =
 * default), batch (optional), sale (optional truthy). Additive: each row = a lot.
 */
export async function importStock(rows: Record<string, string>[]): Promise<StockImportReport> {
  const user = await requirePermission('inventory.manage');
  const report: StockImportReport = { created: 0, skipped: 0, invalid: [] };
  const fallbackLoc = await defaultLocationId();
  const locCache = new Map<string, string>(); // rawLocation(lowercased) → resolved id

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const line = i + 2; // header is row 1
    const sku = (r.sku ?? '').trim();
    if (!sku) { report.invalid.push({ row: line, reason: 'sku required' }); continue; }
    const qty = Math.trunc(Number((r.qty ?? '').trim()));
    if (!Number.isFinite(qty) || qty <= 0) { report.invalid.push({ row: line, reason: 'qty must be a positive number' }); continue; }

    let expiryDate: Date | null;
    try { expiryDate = parseExpiryCell(r.expiry); } catch { report.invalid.push({ row: line, reason: `bad expiry "${r.expiry}"` }); continue; }

    const productId = await resolveProductId(sku);
    if (!productId) { report.invalid.push({ row: line, reason: `no product matches SKU/ID "${sku}"` }); continue; }

    // Resolve location by id OR name (case-insensitive); create it if the name is
    // new. Blank → the default location.
    const rawLoc = (r.location ?? '').trim();
    let locationId: string;
    if (!rawLoc) {
      if (!fallbackLoc) { report.invalid.push({ row: line, reason: 'no default location configured' }); continue; }
      locationId = fallbackLoc;
    } else {
      const key = rawLoc.toLowerCase();
      const cached = locCache.get(key);
      if (cached) {
        locationId = cached;
      } else {
        let loc = await prisma.location.findUnique({ where: { id: rawLoc }, select: { id: true } });
        if (!loc) loc = await prisma.location.findFirst({ where: { name: { equals: rawLoc, mode: 'insensitive' } }, select: { id: true } });
        if (!loc) loc = await prisma.location.create({ data: { name: rawLoc }, select: { id: true } });
        locationId = loc.id;
        locCache.set(key, locationId);
      }
    }

    const priceRaw = (r.price ?? r.priceEgp ?? '').trim();
    const priceEgp = priceRaw ? Number(priceRaw) : null;
    if (priceRaw && !Number.isFinite(priceEgp!)) { report.invalid.push({ row: line, reason: `bad price "${priceRaw}"` }); continue; }
    const saleFlag = /^(1|true|yes|y)$/i.test((r.sale ?? '').trim());

    try {
      await createStockLot({ productId, qty, expiryDate, priceEgp, locationId, saleFlag, batch: (r.batch ?? '').trim() });
      report.created++;
    } catch {
      report.invalid.push({ row: line, reason: 'failed to create lot' });
    }
  }
  await audit({ actorType: 'USER', actorId: user.id, action: 'go-live.stock.import', data: { created: report.created, invalid: report.invalid.length } });
  return report;
}

/** Quick per-product stock add (go-live screen). */
export async function quickAddStock(input: { productId: string; qty: number; expiry?: string | null; priceEgp?: number | null; locationId?: string | null; saleFlag?: boolean }) {
  const user = await requirePermission('inventory.manage');
  if (!input.productId || !(input.qty > 0)) throw new Error('INVALID');
  const locationId = input.locationId || (await defaultLocationId());
  if (!locationId) throw new Error('NO_LOCATION');
  await createStockLot({ productId: input.productId, qty: Math.trunc(input.qty), expiryDate: parseExpiryCell(input.expiry ?? undefined), priceEgp: input.priceEgp ?? null, locationId, saleFlag: input.saleFlag });
  await audit({ actorType: 'USER', actorId: user.id, action: 'go-live.stock.add', entityType: 'Product', entityId: input.productId, data: { qty: input.qty } });
}

// ---- Publish (guarded: only priced + imaged products) ----------------------
/** Publish ready (priced + imaged) products. Stock is not required — an
 *  out-of-stock published product simply stays hidden from the storefront until
 *  it has stock or is flagged pre-order. If ids given, restrict to them. */
export async function publishReady(ids?: string[]): Promise<{ published: number; skipped: number }> {
  const user = await requirePermission('catalog.write');
  const readyWhere = {
    status: { in: [...PRELIVE] },
    basePricePiastres: { gt: 0 },
    images: { some: {} },
    ...(ids && ids.length ? { id: { in: ids } } : {}),
  };
  const ready = await prisma.product.findMany({ where: readyWhere, select: { id: true } });
  const readyIds = ready.map((p) => p.id);
  const published = readyIds.length ? (await prisma.product.updateMany({ where: { id: { in: readyIds } }, data: { status: 'PUBLISHED' } })).count : 0;
  const skipped = ids && ids.length ? ids.length - published : 0;
  await audit({ actorType: 'USER', actorId: user.id, action: 'go-live.publish', entityType: 'Product', entityId: `${published} published` });
  return { published, skipped };
}
