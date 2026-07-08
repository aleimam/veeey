import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { uniqueSlug } from '@/lib/slug';
import { parseSchemaOverrides } from '@/lib/catalog-service';

/** Taxonomy CRUD (FR-CAT-01/08). RBAC-gated + audited. */

// Shared admin-list options. `archived` undefined = no filter (used by pickers);
// with `page` set the list paginates. Array return shape is kept for callers
// that use these for dropdown options.
export type TaxoListOpts = { q?: string; archived?: boolean; sort?: string; dir?: 'asc' | 'desc'; page?: number; perPage?: number };
const archivedWhere = (archived?: boolean) => (archived === undefined ? {} : archived ? { archivedAt: { not: null } } : { archivedAt: null });
const paging = (o: TaxoListOpts) => ({
  skip: o.page != null ? (Math.max(1, o.page) - 1) * (o.perPage ?? 50) : 0,
  take: o.page != null ? (o.perPage ?? 50) : 100000, // not paged → effectively all (pickers)
});

const bilingual = {
  nameEn: z.string().trim().min(1),
  nameAr: z.string().trim().optional().nullable(),
};

// Full SEO module fields shared by Brand + Category (same set as Product).
const seoSchemaFields = {
  slugAr: z.string().trim().optional().nullable(),
  metaTitleEn: z.string().optional().nullable(),
  metaTitleAr: z.string().optional().nullable(),
  metaDescEn: z.string().optional().nullable(),
  metaDescAr: z.string().optional().nullable(),
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
  schemaOverrides: z.string().optional().nullable(),
};
type SeoParsed = z.infer<z.ZodObject<typeof seoSchemaFields>>;

function seoData(d: SeoParsed) {
  return {
    metaTitleEn: d.metaTitleEn ?? null,
    metaTitleAr: d.metaTitleAr ?? null,
    metaDescEn: d.metaDescEn ?? null,
    metaDescAr: d.metaDescAr ?? null,
    focusKeywordEn: d.focusKeywordEn?.trim() || null,
    focusKeywordAr: d.focusKeywordAr?.trim() || null,
    secondaryKeywordsEn: d.secondaryKeywordsEn?.trim() || null,
    secondaryKeywordsAr: d.secondaryKeywordsAr?.trim() || null,
    ogTitleEn: d.ogTitleEn?.trim() || null,
    ogTitleAr: d.ogTitleAr?.trim() || null,
    ogDescEn: d.ogDescEn?.trim() || null,
    ogDescAr: d.ogDescAr?.trim() || null,
    ogImage: d.ogImage?.trim() || null,
    canonicalUrl: d.canonicalUrl?.trim() || null,
    robotsIndex: d.robotsIndex,
    robotsFollow: d.robotsFollow,
    schemaOverridesJson: parseSchemaOverrides(d.schemaOverrides),
  };
}

// ---- Brands ----------------------------------------------------------------
const brandSchema = z.object({
  ...bilingual,
  slug: z.string().trim().optional(),
  descriptionEn: z.string().optional().nullable(),
  descriptionAr: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  bannerUrl: z.string().optional().nullable(),
  ...seoSchemaFields,
});
export type BrandInput = z.input<typeof brandSchema>;

const brandWhere = (o: TaxoListOpts): Prisma.BrandWhereInput => ({
  ...(o.q ? { nameEn: { contains: o.q, mode: 'insensitive' } } : {}),
  ...archivedWhere(o.archived),
});
export const listBrands = (o: TaxoListOpts = {}) =>
  prisma.brand.findMany({ where: brandWhere(o), orderBy: o.sort === 'slug' ? { slug: o.dir ?? 'asc' } : { nameEn: o.dir ?? 'asc' }, ...paging(o) });
export const countBrands = (o: TaxoListOpts = {}) => prisma.brand.count({ where: brandWhere(o) });
export const getBrand = (id: string) => prisma.brand.findUnique({ where: { id } });

export async function saveBrand(id: string | null, raw: BrandInput) {
  const user = await requirePermission('catalog.write');
  const d = brandSchema.parse(raw);
  const slug = await uniqueSlug(d.slug || d.nameEn, async (s) => {
    const found = await prisma.brand.findUnique({ where: { slug: s } });
    return !!found && found.id !== id;
  });
  // Arabic slug auto-generates from the EN slug when blank (slugify is
  // latin-only — same fallback the product form uses).
  const slugAr = await uniqueSlug(d.slugAr || slug, async (s) => {
    const found = await prisma.brand.findFirst({ where: { slugAr: s } });
    return !!found && found.id !== id;
  });
  const data = {
    nameEn: d.nameEn, nameAr: d.nameAr ?? null, slug, slugAr,
    descriptionEn: d.descriptionEn ?? null, descriptionAr: d.descriptionAr ?? null,
    logoUrl: d.logoUrl ?? null, bannerUrl: d.bannerUrl ?? null,
    ...seoData(d),
  };
  const brand = id
    ? await prisma.brand.update({ where: { id }, data })
    : await prisma.brand.create({ data });
  await audit({ actorType: 'USER', actorId: user.id, action: id ? 'brand.update' : 'brand.create', entityType: 'Brand', entityId: brand.id });
  return brand;
}

// ---- Categories ------------------------------------------------------------
const categorySchema = z.object({
  ...bilingual,
  slug: z.string().trim().optional(),
  parentId: z.string().optional().nullable(),
  descriptionEn: z.string().optional().nullable(),
  descriptionAr: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  ...seoSchemaFields,
});
export type CategoryInput = z.input<typeof categorySchema>;

const categoryWhere = (o: TaxoListOpts): Prisma.CategoryWhereInput => ({
  ...(o.q ? { nameEn: { contains: o.q, mode: 'insensitive' } } : {}),
  ...archivedWhere(o.archived),
});
export const listCategories = (o: TaxoListOpts = {}) =>
  prisma.category.findMany({ where: categoryWhere(o), include: { parent: true }, orderBy: o.sort === 'slug' ? { slug: o.dir ?? 'asc' } : { nameEn: o.dir ?? 'asc' }, ...paging(o) });
export const countCategories = (o: TaxoListOpts = {}) => prisma.category.count({ where: categoryWhere(o) });
export const getCategory = (id: string) => prisma.category.findUnique({ where: { id } });

export async function saveCategory(id: string | null, raw: CategoryInput) {
  const user = await requirePermission('catalog.write');
  const d = categorySchema.parse(raw);
  const slug = await uniqueSlug(d.slug || d.nameEn, async (s) => {
    const found = await prisma.category.findUnique({ where: { slug: s } });
    return !!found && found.id !== id;
  });
  const slugAr = await uniqueSlug(d.slugAr || slug, async (s) => {
    const found = await prisma.category.findFirst({ where: { slugAr: s } });
    return !!found && found.id !== id;
  });
  const data = {
    nameEn: d.nameEn, nameAr: d.nameAr ?? null, slug, slugAr,
    parentId: d.parentId || null,
    descriptionEn: d.descriptionEn ?? null, descriptionAr: d.descriptionAr ?? null,
    imageUrl: d.imageUrl ?? null,
    ...seoData(d),
  };
  const category = id
    ? await prisma.category.update({ where: { id }, data })
    : await prisma.category.create({ data });
  await audit({ actorType: 'USER', actorId: user.id, action: id ? 'category.update' : 'category.create', entityType: 'Category', entityId: category.id });
  return category;
}

// ---- Tags ------------------------------------------------------------------
const tagSchema = z.object({ ...bilingual, slug: z.string().trim().optional() });
export type TagInput = z.input<typeof tagSchema>;

const tagWhere = (o: TaxoListOpts): Prisma.TagWhereInput => ({
  ...(o.q ? { nameEn: { contains: o.q, mode: 'insensitive' } } : {}),
  ...archivedWhere(o.archived),
});
export const listTags = (o: TaxoListOpts = {}) =>
  prisma.tag.findMany({ where: tagWhere(o), orderBy: o.sort === 'slug' ? { slug: o.dir ?? 'asc' } : { nameEn: o.dir ?? 'asc' }, ...paging(o) });
export const countTags = (o: TaxoListOpts = {}) => prisma.tag.count({ where: tagWhere(o) });
export const getTag = (id: string) => prisma.tag.findUnique({ where: { id } });

export async function saveTag(id: string | null, raw: TagInput) {
  const user = await requirePermission('catalog.write');
  const d = tagSchema.parse(raw);
  const slug = await uniqueSlug(d.slug || d.nameEn, async (s) => {
    const found = await prisma.tag.findUnique({ where: { slug: s } });
    return !!found && found.id !== id;
  });
  const data = { nameEn: d.nameEn, nameAr: d.nameAr ?? null, slug };
  const tag = id ? await prisma.tag.update({ where: { id }, data }) : await prisma.tag.create({ data });
  await audit({ actorType: 'USER', actorId: user.id, action: id ? 'tag.update' : 'tag.create', entityType: 'Tag', entityId: tag.id });
  return tag;
}

// ---- Attributes + values (governed schema, FR-CAT-08) ----------------------
const attributeSchema = z.object({
  key: z.string().trim().min(1),
  ...bilingual,
  kind: z.enum(['SUPPLEMENT', 'DEVICE', 'INJECTION']).default('SUPPLEMENT'),
});
export type AttributeInput = z.input<typeof attributeSchema>;

export const listAttributes = () =>
  prisma.attribute.findMany({ include: { values: { orderBy: { valueEn: 'asc' } } }, orderBy: { nameEn: 'asc' } });
export const getAttribute = (id: string) =>
  prisma.attribute.findUnique({ where: { id }, include: { values: true } });

export async function saveAttribute(id: string | null, raw: AttributeInput) {
  const user = await requirePermission('catalog.write');
  const d = attributeSchema.parse(raw);
  const data = { key: d.key, nameEn: d.nameEn, nameAr: d.nameAr ?? null, kind: d.kind };
  const attribute = id
    ? await prisma.attribute.update({ where: { id }, data })
    : await prisma.attribute.create({ data });
  await audit({ actorType: 'USER', actorId: user.id, action: id ? 'attribute.update' : 'attribute.create', entityType: 'Attribute', entityId: attribute.id });
  return attribute;
}

export async function addAttributeValue(attributeId: string, valueEn: string, valueAr?: string) {
  await requirePermission('catalog.write');
  return prisma.attributeValue.create({ data: { attributeId, valueEn: valueEn.trim(), valueAr: valueAr?.trim() || null } });
}

export async function deleteAttributeValue(id: string) {
  await requirePermission('catalog.write');
  return prisma.attributeValue.delete({ where: { id } });
}
