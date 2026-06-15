import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { uniqueSlug } from '@/lib/slug';

/** Taxonomy CRUD (FR-CAT-01/08). RBAC-gated + audited. */

const bilingual = {
  nameEn: z.string().trim().min(1),
  nameAr: z.string().trim().optional().nullable(),
};

// ---- Brands ----------------------------------------------------------------
const brandSchema = z.object({
  ...bilingual,
  slug: z.string().trim().optional(),
  descriptionEn: z.string().optional().nullable(),
  descriptionAr: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  metaTitleEn: z.string().optional().nullable(),
  metaDescEn: z.string().optional().nullable(),
});
export type BrandInput = z.input<typeof brandSchema>;

export const listBrands = () => prisma.brand.findMany({ orderBy: { nameEn: 'asc' } });
export const getBrand = (id: string) => prisma.brand.findUnique({ where: { id } });

export async function saveBrand(id: string | null, raw: BrandInput) {
  const user = await requirePermission('catalog.write');
  const d = brandSchema.parse(raw);
  const slug = await uniqueSlug(d.slug || d.nameEn, async (s) => {
    const found = await prisma.brand.findUnique({ where: { slug: s } });
    return !!found && found.id !== id;
  });
  const data = {
    nameEn: d.nameEn, nameAr: d.nameAr ?? null, slug,
    descriptionEn: d.descriptionEn ?? null, descriptionAr: d.descriptionAr ?? null,
    logoUrl: d.logoUrl ?? null, metaTitleEn: d.metaTitleEn ?? null, metaDescEn: d.metaDescEn ?? null,
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
  imageUrl: z.string().optional().nullable(),
  metaTitleEn: z.string().optional().nullable(),
  metaDescEn: z.string().optional().nullable(),
});
export type CategoryInput = z.input<typeof categorySchema>;

export const listCategories = () =>
  prisma.category.findMany({ include: { parent: true }, orderBy: { nameEn: 'asc' } });
export const getCategory = (id: string) => prisma.category.findUnique({ where: { id } });

export async function saveCategory(id: string | null, raw: CategoryInput) {
  const user = await requirePermission('catalog.write');
  const d = categorySchema.parse(raw);
  const slug = await uniqueSlug(d.slug || d.nameEn, async (s) => {
    const found = await prisma.category.findUnique({ where: { slug: s } });
    return !!found && found.id !== id;
  });
  const data = {
    nameEn: d.nameEn, nameAr: d.nameAr ?? null, slug,
    parentId: d.parentId || null, descriptionEn: d.descriptionEn ?? null,
    imageUrl: d.imageUrl ?? null, metaTitleEn: d.metaTitleEn ?? null, metaDescEn: d.metaDescEn ?? null,
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

export const listTags = () => prisma.tag.findMany({ orderBy: { nameEn: 'asc' } });
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
