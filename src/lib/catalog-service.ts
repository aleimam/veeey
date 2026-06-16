import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { egpToPiastres } from '@/lib/format';
import { uniqueSlug } from '@/lib/slug';
import { brandCode, skuFromParts } from '@/lib/sku';

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
  brandId: z.string().optional().nullable(),
  basePriceEgp: z.coerce.number().nonnegative().default(0),
  shortDescEn: z.string().optional().nullable(),
  shortDescAr: z.string().optional().nullable(),
  longDescEn: z.string().optional().nullable(),
  longDescAr: z.string().optional().nullable(),
  weightG: z.coerce.number().int().nonnegative().optional().nullable(),
  servingsPerUnit: z.coerce.number().int().nonnegative().optional().nullable(),
  dailyDosage: z.coerce.number().int().nonnegative().optional().nullable(),
  dailyDosageMax: z.coerce.number().int().nonnegative().optional().nullable(),
  productType: z
    .enum(['MISCELLANEOUS', 'MALE_SUPPORT', 'PREMIUM', 'NEW', 'TREND'])
    .optional()
    .nullable(),
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
  return {
    nameEn: data.nameEn,
    nameAr: data.nameAr ?? null,
    kind: data.kind,
    status: data.status,
    brandId: data.brandId || null,
    basePricePiastres: egpToPiastres(data.basePriceEgp),
    shortDescEn: data.shortDescEn ?? null,
    shortDescAr: data.shortDescAr ?? null,
    longDescEn: data.longDescEn ?? null,
    longDescAr: data.longDescAr ?? null,
    weightG: data.weightG ?? null,
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
  };
}

export async function listProducts(opts: { search?: string; status?: string } = {}) {
  return prisma.product.findMany({
    where: {
      ...(opts.search
        ? { OR: [{ nameEn: { contains: opts.search, mode: 'insensitive' } }, { sku: { contains: opts.search, mode: 'insensitive' } }] }
        : {}),
      ...(opts.status ? { status: opts.status as 'DRAFT' | 'PUBLISHED' | 'PRIVATE' | 'ARCHIVED' } : {}),
    },
    include: { brand: true, images: { take: 1, orderBy: { sortOrder: 'asc' } } },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });
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

export async function createProduct(raw: ProductWriteInput) {
  const user = await requirePermission('catalog.write');
  const data = productWriteSchema.parse(raw);

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
  return product;
}

export async function updateProduct(id: string, raw: ProductWriteInput) {
  const user = await requirePermission('catalog.write');
  const data = productWriteSchema.parse(raw);

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

  await audit({ actorType: 'USER', actorId: user.id, action: 'product.update', entityType: 'Product', entityId: id });
  return product;
}

export async function setProductStatus(id: string, status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED') {
  const user = await requirePermission('catalog.write');
  const product = await prisma.product.update({ where: { id }, data: { status } });
  await audit({ actorType: 'USER', actorId: user.id, action: `product.${status.toLowerCase()}`, entityType: 'Product', entityId: id });
  return product;
}
