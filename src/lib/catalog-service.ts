import { z } from 'zod';
import { Prisma as PrismaRt, type Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { egpToPiastres } from '@/lib/format';
import { uniqueSlug } from '@/lib/slug';
import { brandCode, skuFromParts } from '@/lib/sku';
import { getNumberSetting } from '@/lib/settings-service';
import { recordPriceDropIfLower } from '@/lib/alert-service';

/**
 * Catalog service (FR-CAT-*). All writes are RBAC-gated and audited. Business
 * logic lives here (out of components, mirroring YeldnIN's *-service pattern).
 */

export const productWriteSchema = z.object({
  sku: z.string().trim().optional(),
  nameEn: z.string().trim().min(1),
  nameAr: z.string().trim().optional().nullable(),
  slugEn: z.string().trim().optional(),
  slugAr: z.string().trim().optional(),
  kind: z.enum(['SUPPLEMENT', 'DEVICE', 'INJECTION']).default('SUPPLEMENT'),
  status: z.enum(['DRAFT', 'PUBLISHED', 'PRIVATE', 'ARCHIVED']).default('PUBLISHED'),
  preorderEnabled: z.coerce.boolean().default(false),
  brandId: z.string().optional().nullable(),
  basePriceEgp: z.coerce.number().nonnegative().default(0),
  shortDescEn: z.string().optional().nullable(),
  shortDescAr: z.string().optional().nullable(),
  longDescEn: z.string().optional().nullable(),
  longDescAr: z.string().optional().nullable(),
  weightG: z.coerce.number().int().nonnegative().optional().nullable(),
  reorderPoint: z.coerce.number().int().nonnegative().optional().nullable(),
  servingsPerUnit: z.coerce.number().int().nonnegative().optional().nullable(),
  dailyDosage: z.coerce.number().int().nonnegative().optional().nullable(),
  dailyDosageMax: z.coerce.number().int().nonnegative().optional().nullable(),
  productType: z
    .enum(['MISCELLANEOUS', 'MALE_SUPPORT', 'PREMIUM', 'NEW', 'TREND'])
    .optional()
    .nullable(),
  // Merchandising flag + sourcing (internal). purchaseCost is in MAJOR units of
  // the origin currency; stored as minor units, currency derived from origin.
  maleSupport: z.coerce.boolean().default(false),
  purchaseUrl: z.string().trim().optional().nullable(),
  originCountry: z.enum(['USA', 'UK', 'EU']).optional().nullable(),
  purchaseCost: z.coerce.number().nonnegative().optional().nullable(),
  categoryIds: z.array(z.string()).max(4).default([]),
  tagIds: z.array(z.string()).default([]),
  attributeValueIds: z.array(z.string()).default([]),
  imageUrls: z.array(z.string()).default([]),
  // Restriction profile (FR-RES-01) — default off.
  restricted: z.boolean().default(false),
  restrictHideCatalog: z.boolean().default(false),
  restrictHideFeeds: z.boolean().default(false),
  restrictDisableCards: z.boolean().default(false),
  restrictRequireLogin: z.boolean().default(false),
  restrictAgeConsent: z.boolean().default(false),
  // SEO/AEO (FR-SEO-07)
  metaTitleEn: z.string().optional().nullable(),
  metaTitleAr: z.string().optional().nullable(),
  metaDescEn: z.string().optional().nullable(),
  metaDescAr: z.string().optional().nullable(),
  aiSummaryEn: z.string().optional().nullable(),
  aiSummaryAr: z.string().optional().nullable(),
  // Full SEO module (RankMath-style editor)
  focusKeywordEn: z.string().optional().nullable(),
  focusKeywordAr: z.string().optional().nullable(),
  secondaryKeywordsEn: z.string().optional().nullable(),
  secondaryKeywordsAr: z.string().optional().nullable(),
  ogTitleEn: z.string().optional().nullable(),
  ogTitleAr: z.string().optional().nullable(),
  ogDescEn: z.string().optional().nullable(),
  ogDescAr: z.string().optional().nullable(),
  ogImage: z.string().optional().nullable(),
  canonicalUrl: z.string().optional().nullable(),
  robotsIndex: z.boolean().default(true),
  robotsFollow: z.boolean().default(true),
  schemaOverrides: z.string().optional().nullable(), // JSON text; invalid → stored as null
});

export type ProductWriteInput = z.input<typeof productWriteSchema>;

async function generateUniqueSku(brandId?: string | null): Promise<string> {
  const brand = brandId
    ? await prisma.brand.findUnique({ where: { id: brandId } })
    : null;
  const code = brandCode(brand?.nameEn ?? 'GEN');
  let seq = (await prisma.product.count()) + 1;
  let sku = skuFromParts(code, seq);
  while (await prisma.product.findUnique({ where: { sku } })) {
    sku = skuFromParts(code, ++seq);
  }
  return sku;
}

function scalarFields(data: z.infer<typeof productWriteSchema>) {
  const origin = data.originCountry ?? null;
  const currency = origin === 'USA' ? 'USD' : origin === 'UK' ? 'GBP' : origin === 'EU' ? 'EUR' : null;
  return {
    maleSupport: data.maleSupport,
    purchaseUrl: data.purchaseUrl ?? null,
    originCountry: origin,
    purchaseCurrency: currency,
    purchaseCostMinor: data.purchaseCost != null ? Math.round(data.purchaseCost * 100) : null,
    nameEn: data.nameEn,
    nameAr: data.nameAr ?? null,
    kind: data.kind,
    status: data.status,
    preorderEnabled: data.preorderEnabled,
    brandId: data.brandId || null,
    basePricePiastres: egpToPiastres(data.basePriceEgp),
    shortDescEn: data.shortDescEn ?? null,
    shortDescAr: data.shortDescAr ?? null,
    longDescEn: data.longDescEn ?? null,
    longDescAr: data.longDescAr ?? null,
    weightG: data.weightG ?? null,
    reorderPoint: data.reorderPoint ?? null,
    servingsPerUnit: data.servingsPerUnit ?? null,
    dailyDosage: data.dailyDosage ?? null,
    dailyDosageMax: data.dailyDosageMax ?? null,
    productType: data.productType ?? null,
    restricted: data.restricted,
    restrictHideCatalog: data.restrictHideCatalog,
    restrictHideFeeds: data.restrictHideFeeds,
    restrictDisableCards: data.restrictDisableCards,
    restrictRequireLogin: data.restrictRequireLogin,
    restrictAgeConsent: data.restrictAgeConsent,
    metaTitleEn: data.metaTitleEn ?? null,
    metaTitleAr: data.metaTitleAr ?? null,
    metaDescEn: data.metaDescEn ?? null,
    metaDescAr: data.metaDescAr ?? null,
    aiSummaryEn: data.aiSummaryEn ?? null,
    aiSummaryAr: data.aiSummaryAr ?? null,
    focusKeywordEn: data.focusKeywordEn?.trim() || null,
    focusKeywordAr: data.focusKeywordAr?.trim() || null,
    secondaryKeywordsEn: data.secondaryKeywordsEn?.trim() || null,
    secondaryKeywordsAr: data.secondaryKeywordsAr?.trim() || null,
    ogTitleEn: data.ogTitleEn?.trim() || null,
    ogTitleAr: data.ogTitleAr?.trim() || null,
    ogDescEn: data.ogDescEn?.trim() || null,
    ogDescAr: data.ogDescAr?.trim() || null,
    ogImage: data.ogImage?.trim() || null,
    canonicalUrl: data.canonicalUrl?.trim() || null,
    robotsIndex: data.robotsIndex,
    robotsFollow: data.robotsFollow,
    schemaOverridesJson: parseSchemaOverrides(data.schemaOverrides),
  };
}

/** Parse editable schema overrides (JSON text); invalid/empty → DbNull. Shared
 *  by the product/brand/category SEO modules. */
export function parseSchemaOverrides(s: string | null | undefined): Prisma.InputJsonValue | typeof PrismaRt.DbNull {
  if (!s || !s.trim()) return PrismaRt.DbNull;
  try {
    const v = JSON.parse(s);
    return v && typeof v === 'object' ? (v as Prisma.InputJsonValue) : PrismaRt.DbNull;
  } catch {
    return PrismaRt.DbNull;
  }
}

export type ProductListOpts = {
  search?: string; status?: string; kind?: string; brand?: string;
  flag?: string; // data-completeness / sourcing / stock filter (PRODUCT_FLAGS)
  origin?: string; // 'USA' | 'UK' | 'EU' | 'none'
  tag?: string; // filter to products carrying this tag id (e.g. from the Tags usage-count link)
  category?: string; // filter to products in this category id
  sort?: string; dir?: 'asc' | 'desc'; page?: number; perPage?: number;
};

/** Data-quality filter codes for the products list (+ export). */
export const PRODUCT_FLAGS = [
  'missing_brand', 'missing_image', 'missing_category', 'price_zero',
  'missing_purchase_price', 'missing_arabic', 'missing_purchase_url',
  'out_of_stock', 'low_stock',
] as const;

/** Per-product sellable stock (sum of LIVE lots' onHand - reserved). */
async function sellableByProduct(): Promise<Map<string, number>> {
  const rows = await prisma.lot.groupBy({
    by: ['productId'],
    where: { status: 'LIVE' },
    _sum: { qtyOnHand: true, qtyReserved: true },
  });
  return new Map(rows.map((r) => [r.productId, (r._sum.qtyOnHand ?? 0) - (r._sum.qtyReserved ?? 0)]));
}

async function flagWhere(flag: string): Promise<Prisma.ProductWhereInput> {
  switch (flag) {
    case 'missing_brand': return { brandId: null };
    case 'missing_image': return { images: { none: {} } };
    case 'missing_category': return { categories: { none: {} } };
    case 'price_zero': return { basePricePiastres: 0 };
    case 'missing_purchase_price': return { purchaseCostMinor: null };
    case 'missing_arabic': return { OR: [{ nameAr: null }, { nameAr: '' }, { longDescAr: null }, { longDescAr: '' }] };
    case 'missing_purchase_url': return { OR: [{ purchaseUrl: null }, { purchaseUrl: '' }] };
    case 'out_of_stock': {
      const sellable = await sellableByProduct();
      const inStock = [...sellable.entries()].filter(([, n]) => n > 0).map(([id]) => id);
      return { id: { notIn: inStock } };
    }
    case 'low_stock': {
      const threshold = await getNumberSetting('catalog.lowStockThreshold');
      const sellable = await sellableByProduct();
      const low = [...sellable.entries()].filter(([, n]) => n > 0 && n <= Math.max(1, threshold)).map(([id]) => id);
      return { id: { in: low } };
    }
    default: return {};
  }
}

/** Admin list/export where-builder (async — stock flags aggregate live lots). */
export async function productAdminWhere(opts: ProductListOpts): Promise<Prisma.ProductWhereInput> {
  return {
    ...(opts.search ? { OR: [{ nameEn: { contains: opts.search, mode: 'insensitive' } }, { sku: { contains: opts.search, mode: 'insensitive' } }] } : {}),
    ...(opts.status ? { status: opts.status as 'DRAFT' | 'PUBLISHED' | 'PRIVATE' | 'ARCHIVED' } : {}),
    ...(opts.kind ? { kind: opts.kind as 'SUPPLEMENT' | 'DEVICE' | 'INJECTION' } : {}),
    ...(opts.brand ? { brandId: opts.brand } : {}),
    ...(opts.origin ? (opts.origin === 'none' ? { originCountry: null } : { originCountry: opts.origin }) : {}),
    ...(opts.tag ? { tags: { some: { id: opts.tag } } } : {}),
    ...(opts.category ? { categories: { some: { id: opts.category } } } : {}),
    ...(opts.flag ? { AND: [await flagWhere(opts.flag)] } : {}),
  };
}

function productOrderBy(sort?: string, dir: 'asc' | 'desc' = 'desc'): Prisma.ProductOrderByWithRelationInput {
  switch (sort) {
    case 'name': return { nameEn: dir };
    case 'sku': return { sku: dir };
    case 'price': return { basePricePiastres: dir };
    case 'status': return { status: dir };
    case 'created': return { createdAt: dir };
    default: return { updatedAt: dir };
  }
}

/**
 * List products for the admin. Without `page` it returns up to 200 (used by
 * pickers); with `page` it paginates by `perPage` and applies the sort column.
 */
/** Stock + margin inputs for the products list's inventory columns (V7 C13).
 *  One query for the visible page's ids; the math lives in inventory-columns. */
export async function inventoryColumnsFor(productIds: string[]) {
  if (productIds.length === 0) return new Map();
  const { summarizeLots } = await import('@/lib/inventory-columns');
  const lots = await prisma.lot.findMany({
    where: { productId: { in: productIds }, status: 'LIVE' },
    select: { productId: true, qtyOnHand: true, qtyReserved: true, costPiastres: true },
  });
  return summarizeLots(lots);
}

export async function listProducts(opts: ProductListOpts = {}) {
  const perPage = opts.perPage ?? 50;
  const take = opts.page != null ? perPage : 200;
  const skip = opts.page != null ? (Math.max(1, opts.page) - 1) * perPage : 0;
  return prisma.product.findMany({
    where: await productAdminWhere(opts),
    include: { brand: true, images: { take: 1, orderBy: { sortOrder: 'asc' } } },
    orderBy: productOrderBy(opts.sort, opts.dir),
    skip,
    take,
  });
}

export async function countProducts(opts: ProductListOpts = {}) {
  return prisma.product.count({ where: await productAdminWhere(opts) });
}

export function getProduct(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: {
      brand: true,
      categories: true,
      tags: true,
      images: { orderBy: { sortOrder: 'asc' } },
      attributeValues: { include: { attributeValue: { include: { attribute: true } } } },
    },
  });
}

/** Enforce that every REQUIRED attribute applying to this product kind has at
 *  least one chosen value (V3-ATTR-3). Dormant until the owner marks an
 *  attribute required, so it never breaks existing saves/imports. */
async function assertRequiredAttributes(kind: string, attributeValueIds: string[]) {
  const required = await prisma.attribute.findMany({
    where: { archivedAt: null, isRequired: true, kinds: { has: kind as 'SUPPLEMENT' | 'DEVICE' | 'INJECTION' } },
    select: { nameEn: true, values: { select: { id: true } } },
  });
  if (!required.length) return;
  const chosen = new Set(attributeValueIds);
  const missing = required.filter((a) => !a.values.some((v) => chosen.has(v.id)));
  if (missing.length) throw new Error(`MISSING_REQUIRED_ATTRIBUTES: ${missing.map((a) => a.nameEn).join(', ')}`);
}

/**
 * Best-effort: mirror a product to YeldnIN via the outbox (catalog sync channel).
 * Dormant until INTEGRATION_ENABLED — early-returns with no DB work when off, so the
 * common (disabled) path costs at most one flag read. Never throws: a sync hiccup
 * must not fail the product write it trails. Keyed on the WordPress id (`wpId` =
 * `legacyWpId`); products without one are skipped (they can't correlate to YeldnIN).
 * Mirrors `emitRequestSync` in `request-service.ts`.
 */
export async function emitCatalogSync(productId: string): Promise<void> {
  try {
    const { integrationEnabled } = await import('@/lib/integration/config');
    if (!(await integrationEnabled())) return;
    const [{ recordOutbox }, { productToWire }] = await Promise.all([
      import('@/lib/integration/integration-service'),
      import('@/lib/integration/catalog-sync'),
    ]);
    const p = await prisma.product.findUnique({
      where: { id: productId },
      select: { legacyWpId: true, sku: true, nameEn: true, kind: true, status: true },
    });
    if (!p || p.legacyWpId == null) return;
    const wire = productToWire({ legacyWpId: p.legacyWpId, sku: p.sku, nameEn: p.nameEn, kind: p.kind, status: p.status });
    await recordOutbox('catalog.upsert', String(wire.wpId), wire);
  } catch (e) {
    console.error('catalog sync emit failed', e);
  }
}

/**
 * Backfill the catalog outbox: queue a `catalog.upsert` for every product that
 * carries a WordPress id. Paginated (500/page, cursor by id) so it scales to the
 * full ~2.5k catalog. Returns the number actually queued — `recordOutbox` no-ops
 * while the integration is disabled, so this only enqueues once an operator has
 * enabled the link. An operator runs it once via a script; the dispatcher drains
 * the outbox.
 */
export async function backfillCatalog(): Promise<{ queued: number }> {
  const [{ recordOutbox }, { productToWire }] = await Promise.all([
    import('@/lib/integration/integration-service'),
    import('@/lib/integration/catalog-sync'),
  ]);
  const pageSize = 500;
  let cursor: string | undefined;
  let queued = 0;
  for (;;) {
    const batch = await prisma.product.findMany({
      where: { legacyWpId: { not: null } },
      select: { id: true, legacyWpId: true, sku: true, nameEn: true, kind: true, status: true },
      orderBy: { id: 'asc' },
      take: pageSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (batch.length === 0) break;
    for (const p of batch) {
      if (p.legacyWpId == null) continue;
      const wire = productToWire({ legacyWpId: p.legacyWpId, sku: p.sku, nameEn: p.nameEn, kind: p.kind, status: p.status });
      const ev = await recordOutbox('catalog.upsert', String(wire.wpId), wire);
      if (ev) queued += 1;
    }
    cursor = batch[batch.length - 1].id;
    if (batch.length < pageSize) break;
  }
  return { queued };
}

export async function createProduct(raw: ProductWriteInput) {
  const user = await requirePermission('catalog.write');
  const data = productWriteSchema.parse(raw);
  await assertRequiredAttributes(data.kind, data.attributeValueIds);

  const sku = data.sku || (await generateUniqueSku(data.brandId));
  const slugEn = await uniqueSlug(data.slugEn || data.nameEn, async (s) =>
    !!(await prisma.product.findUnique({ where: { slugEn: s } })),
  );
  const slugAr = await uniqueSlug(data.slugAr || slugEn, async (s) =>
    !!(await prisma.product.findUnique({ where: { slugAr: s } })),
  );

  const product = await prisma.product.create({
    data: {
      ...scalarFields(data),
      sku,
      slugEn,
      slugAr,
      categories: { connect: data.categoryIds.map((id) => ({ id })) },
      tags: { connect: data.tagIds.map((id) => ({ id })) },
      attributeValues: { create: data.attributeValueIds.map((attributeValueId) => ({ attributeValueId })) },
      images: { create: data.imageUrls.map((url, i) => ({ url, sortOrder: i, isPrimary: i === 0 })) },
    },
  });

  await audit({ actorType: 'USER', actorId: user.id, action: 'product.create', entityType: 'Product', entityId: product.id });
  await emitCatalogSync(product.id);
  return product;
}

export async function updateProduct(id: string, raw: ProductWriteInput) {
  const user = await requirePermission('catalog.write');
  const data = productWriteSchema.parse(raw);
  await assertRequiredAttributes(data.kind, data.attributeValueIds);

  const before = await prisma.product.findUnique({ where: { id }, select: { basePricePiastres: true } });

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...scalarFields(data),
      categories: { set: data.categoryIds.map((cid) => ({ id: cid })) },
      tags: { set: data.tagIds.map((tid) => ({ id: tid })) },
      attributeValues: {
        deleteMany: {},
        create: data.attributeValueIds.map((attributeValueId) => ({ attributeValueId })),
      },
      ...(data.imageUrls.length
        ? { images: { deleteMany: {}, create: data.imageUrls.map((url, i) => ({ url, sortOrder: i, isPrimary: i === 0 })) } }
        : {}),
    },
  });

  // Wishlist price-drop alert (FR-WSH-02) — fires only when the price went DOWN.
  if (before) await recordPriceDropIfLower(id, before.basePricePiastres, product.basePricePiastres);

  await audit({ actorType: 'USER', actorId: user.id, action: 'product.update', entityType: 'Product', entityId: id });
  await emitCatalogSync(id);
  return product;
}

export async function setProductStatus(id: string, status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED') {
  const user = await requirePermission('catalog.write');
  const product = await prisma.product.update({ where: { id }, data: { status } });
  await audit({ actorType: 'USER', actorId: user.id, action: `product.${status.toLowerCase()}`, entityType: 'Product', entityId: id });
  return product;
}
