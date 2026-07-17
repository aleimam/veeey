import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { uniqueSlug } from '@/lib/slug';
import { decodePercentSlug } from '@/lib/decode-entities';
import { slugify } from '@/lib/sku';
import { parseSchemaOverrides } from '@/lib/catalog-service';

/** Taxonomy CRUD (FR-CAT-01/08). RBAC-gated + audited. */

// Shared admin-list options. `archived` undefined = no filter (used by pickers);
// with `page` set the list paginates. Array return shape is kept for callers
// that use these for dropdown options.
export type TaxoListOpts = { q?: string; archived?: boolean; flag?: string; sort?: string; dir?: 'asc' | 'desc'; page?: number; perPage?: number };
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

/** Data-completeness filters for the brands list (V2 BR-3). */
function brandFlagWhere(flag?: string): Prisma.BrandWhereInput {
  switch (flag) {
    case 'missing_ar_name': return { OR: [{ nameAr: null }, { nameAr: '' }] };
    case 'missing_logo': return { OR: [{ logoUrl: null }, { logoUrl: '' }] };
    case 'missing_banner': return { OR: [{ bannerUrl: null }, { bannerUrl: '' }] };
    case 'missing_description': return { AND: [{ OR: [{ descriptionEn: null }, { descriptionEn: '' }] }, { OR: [{ descriptionAr: null }, { descriptionAr: '' }] }] };
    case 'zero_products': return { products: { none: {} } };
    default: return {};
  }
}

const brandWhere = (o: TaxoListOpts): Prisma.BrandWhereInput => ({
  ...(o.q ? { nameEn: { contains: o.q, mode: 'insensitive' } } : {}),
  ...archivedWhere(o.archived),
  ...(o.flag ? { AND: [brandFlagWhere(o.flag)] } : {}),
});
export const listBrands = (o: TaxoListOpts = {}) =>
  prisma.brand.findMany({
    where: brandWhere(o),
    include: { _count: { select: { products: true } } },
    orderBy: o.sort === 'slug' ? { slug: o.dir ?? 'asc' } : { nameEn: o.dir ?? 'asc' },
    ...paging(o),
  });
export const countBrands = (o: TaxoListOpts = {}) => prisma.brand.count({ where: brandWhere(o) });
export const getBrand = (id: string) => prisma.brand.findUnique({ where: { id } });

export async function saveBrand(id: string | null, raw: BrandInput) {
  const user = await requirePermission('catalog.write');
  const d = brandSchema.parse(raw);
  // Same percent-encoding guard as categories (V7 audit C4).
  const slug = await uniqueSlug(decodePercentSlug(d.slug || '') || d.nameEn, async (s) => {
    const found = await prisma.brand.findUnique({ where: { slug: s } });
    return !!found && found.id !== id;
  });
  // Arabic slug auto-generates from the EN slug when blank (slugify is
  // latin-only — same fallback the product form uses).
  const slugAr = await uniqueSlug(decodePercentSlug(d.slugAr || '') || slug, async (s) => {
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

// ---- Brand Arabic-name bulk translation (V2 BR-3) ---------------------------
// Runs in the WORKER (no session): the enqueuing action is RBAC-gated. Progress
// is written to the generic Setting KV so the brands page can show status.
const TRANSLATE_STATUS_KEY = 'brands.translateJob';
export type BrandTranslateStatus = {
  state: 'running' | 'done' | 'error';
  done: number; total: number; failed: number; at: string;
  /** V7 audit C5: the actual failure cause, verbatim, for the admin banner. */
  error?: string;
};

async function setTranslateStatus(v: BrandTranslateStatus) {
  const value = JSON.stringify(v);
  await prisma.setting.upsert({ where: { key: TRANSLATE_STATUS_KEY }, update: { value }, create: { key: TRANSLATE_STATUS_KEY, value } });
}

export async function getBrandTranslateStatus(): Promise<BrandTranslateStatus | null> {
  const row = await prisma.setting.findUnique({ where: { key: TRANSLATE_STATUS_KEY } });
  if (!row) return null;
  try { return JSON.parse(row.value) as BrandTranslateStatus; } catch { return null; }
}

/** Translate every empty Arabic brand name via AI, in chunks. Each write goes
 *  through prisma.brand.update so the field-level change log records it.
 *  V7 audit C5: failures carry the provider's actual message into the status
 *  (the banner used to guess), transient errors get retried with backoff, and
 *  a missing key aborts up front instead of burning through every chunk. */
export async function runBrandNameTranslation(): Promise<BrandTranslateStatus> {
  const { translateToArabicDetailed } = await import('@/lib/ai');
  const brands = await prisma.brand.findMany({
    where: { archivedAt: null, OR: [{ nameAr: null }, { nameAr: '' }] },
    select: { id: true, nameEn: true },
    orderBy: { nameEn: 'asc' },
  });
  const total = brands.length;
  let done = 0;
  let failed = 0;
  let lastError: string | undefined;
  const now = () => new Date().toISOString();
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  await setTranslateStatus({ state: 'running', done, total, failed, at: now() });

  const CHUNK = 10;
  const RETRIES = 2; // worker context — a short backoff costs nothing
  for (let i = 0; i < brands.length; i += CHUNK) {
    const chunk = brands.slice(i, i + CHUNK);

    let out: Record<string, string> | null = null;
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
      const res = await translateToArabicDetailed(Object.fromEntries(chunk.map((b) => [b.id, b.nameEn])));
      if (res.ok) { out = res.values; break; }
      lastError = res.message;
      if (res.reason === 'not_configured') {
        // No key means every remaining chunk fails identically — stop now and
        // say so, instead of reporting 647 "failed" with no explanation.
        const status: BrandTranslateStatus = { state: 'error', done, total, failed: total - done, at: now(), error: res.message };
        await setTranslateStatus(status);
        return status;
      }
      if (attempt < RETRIES) await sleep(2000 * (attempt + 1));
    }

    if (!out) {
      failed += chunk.length;
      if (i === 0) {
        // Persistent provider failure on the very first chunk — fatal.
        const status: BrandTranslateStatus = { state: 'error', done, total, failed, at: now(), error: lastError };
        await setTranslateStatus(status);
        return status;
      }
      continue;
    }
    for (const b of chunk) {
      const ar = out[b.id]?.trim();
      if (ar) {
        await prisma.brand.update({ where: { id: b.id }, data: { nameAr: ar } });
        done++;
      } else {
        failed++;
      }
    }
    await setTranslateStatus({ state: 'running', done, total, failed, at: now() });
  }

  const status: BrandTranslateStatus = { state: 'done', done, total, failed, at: now(), error: failed ? lastError : undefined };
  await setTranslateStatus(status);
  await audit({ actorType: 'SYSTEM', action: 'brands.translate.run', entityType: 'Brand', entityId: `${done}/${total} translated`, data: { done, total, failed } });
  return status;
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

/** Data-completeness filters for the categories list (V2 CAT-3). */
function categoryFlagWhere(flag?: string): Prisma.CategoryWhereInput {
  switch (flag) {
    case 'missing_ar_name': return { OR: [{ nameAr: null }, { nameAr: '' }] };
    case 'missing_image': return { OR: [{ imageUrl: null }, { imageUrl: '' }] };
    case 'missing_description': return { AND: [{ OR: [{ descriptionEn: null }, { descriptionEn: '' }] }, { OR: [{ descriptionAr: null }, { descriptionAr: '' }] }] };
    case 'zero_products': return { products: { none: {} } };
    default: return {};
  }
}

const categoryWhere = (o: TaxoListOpts): Prisma.CategoryWhereInput => ({
  ...(o.q ? { nameEn: { contains: o.q, mode: 'insensitive' } } : {}),
  ...archivedWhere(o.archived),
  ...(o.flag ? { AND: [categoryFlagWhere(o.flag)] } : {}),
});
export const listCategories = (o: TaxoListOpts = {}) =>
  prisma.category.findMany({
    where: categoryWhere(o),
    include: { parent: true, _count: { select: { products: true, children: true } } },
    orderBy: o.sort === 'slug' ? { slug: o.dir ?? 'asc' } : { nameEn: o.dir ?? 'asc' },
    ...paging(o),
  });
export const countCategories = (o: TaxoListOpts = {}) => prisma.category.count({ where: categoryWhere(o) });
export const getCategory = (id: string) => prisma.category.findUnique({ where: { id } });

export async function saveCategory(id: string | null, raw: CategoryInput) {
  const user = await requirePermission('catalog.write');
  const d = categorySchema.parse(raw);
  // V7 audit C4: a pasted percent-encoded slug can never match a lookup
  // (Next hands query params over decoded) — store the decoded form.
  const slug = await uniqueSlug(decodePercentSlug(d.slug || '') || d.nameEn, async (s) => {
    const found = await prisma.category.findUnique({ where: { slug: s } });
    return !!found && found.id !== id;
  });
  const slugAr = await uniqueSlug(decodePercentSlug(d.slugAr || '') || slug, async (s) => {
    const found = await prisma.category.findFirst({ where: { slugAr: s } });
    return !!found && found.id !== id;
  });
  // V7 audit C6: renaming a slug must not orphan old links — record a redirect
  // in the same format the storefront's category loader resolves.
  const before = id ? await prisma.category.findUnique({ where: { id }, select: { slug: true } }) : null;
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
  if (before && before.slug !== slug) {
    await prisma.redirect.upsert({
      where: { fromPath: `/products?category=${before.slug}` },
      update: { toPath: `/products?category=${slug}` },
      create: { fromPath: `/products?category=${before.slug}`, toPath: `/products?category=${slug}` },
    });
    // A chain that used to end at the old slug now skips straight to the new
    // one — the loader follows only ONE redirect hop.
    await prisma.redirect.updateMany({
      where: { toPath: `/products?category=${before.slug}` },
      data: { toPath: `/products?category=${slug}` },
    });
    // The new slug resolves directly now; a leftover redirect FROM it (e.g.
    // after renaming back) would be a dead row or a self-loop.
    await prisma.redirect.deleteMany({ where: { fromPath: `/products?category=${slug}` } });
  }
  await audit({ actorType: 'USER', actorId: user.id, action: id ? 'category.update' : 'category.create', entityType: 'Category', entityId: category.id });
  return category;
}

// ---- Tags ------------------------------------------------------------------
const tagSchema = z.object({ ...bilingual, slug: z.string().trim().optional() });
export type TagInput = z.input<typeof tagSchema>;

function tagFlagWhere(flag?: string): Prisma.TagWhereInput {
  switch (flag) {
    case 'missing_ar_name': return { OR: [{ nameAr: null }, { nameAr: '' }] };
    case 'zero_products': return { products: { none: {} } };
    default: return {};
  }
}
const tagWhere = (o: TaxoListOpts): Prisma.TagWhereInput => ({
  ...(o.q ? { nameEn: { contains: o.q, mode: 'insensitive' } } : {}),
  ...archivedWhere(o.archived),
  ...(o.flag ? { AND: [tagFlagWhere(o.flag)] } : {}),
});
export const listTags = (o: TaxoListOpts = {}) =>
  prisma.tag.findMany({
    where: tagWhere(o),
    include: { _count: { select: { products: true } } },
    orderBy: o.sort === 'slug' ? { slug: o.dir ?? 'asc' } : { nameEn: o.dir ?? 'asc' },
    ...paging(o),
  });
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
const KIND = z.enum(['SUPPLEMENT', 'DEVICE', 'INJECTION']);
const attributeSchema = z.object({
  key: z.string().trim().min(1),
  ...bilingual,
  kinds: z.array(KIND).min(1).default(['SUPPLEMENT']), // multi-type "applies to"
  inputType: z.enum(['SINGLE_SELECT', 'MULTI_SELECT']).default('SINGLE_SELECT'),
  descriptionEn: z.string().optional().nullable(),
  descriptionAr: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
  isFilterable: z.boolean().default(false),
  isRequired: z.boolean().default(false),
});
export type AttributeInput = z.input<typeof attributeSchema>;

export const listAttributes = () =>
  prisma.attribute.findMany({ include: { values: { orderBy: [{ sortOrder: 'asc' }, { valueEn: 'asc' }] } }, orderBy: { nameEn: 'asc' } });
export const getAttribute = (id: string) =>
  prisma.attribute.findUnique({ where: { id }, include: { values: { orderBy: [{ sortOrder: 'asc' }, { valueEn: 'asc' }] } } });

export async function saveAttribute(id: string | null, raw: AttributeInput) {
  const user = await requirePermission('catalog.write');
  const d = attributeSchema.parse(raw);
  const data = {
    key: d.key, nameEn: d.nameEn, nameAr: d.nameAr ?? null,
    kinds: d.kinds, kind: d.kinds[0] ?? 'SUPPLEMENT', // keep the legacy single column in sync
    inputType: d.inputType,
    descriptionEn: d.descriptionEn || null, descriptionAr: d.descriptionAr || null,
    unit: d.unit || null, isFilterable: d.isFilterable, isRequired: d.isRequired,
  };
  const attribute = id
    ? await prisma.attribute.update({ where: { id }, data })
    : await prisma.attribute.create({ data });
  await audit({ actorType: 'USER', actorId: user.id, action: id ? 'attribute.update' : 'attribute.create', entityType: 'Attribute', entityId: attribute.id });
  return attribute;
}

export async function addAttributeValue(attributeId: string, valueEn: string, valueAr?: string, slug?: string) {
  await requirePermission('catalog.write');
  const max = await prisma.attributeValue.aggregate({ where: { attributeId }, _max: { sortOrder: true } });
  return prisma.attributeValue.create({
    data: {
      attributeId, valueEn: valueEn.trim(), valueAr: valueAr?.trim() || null,
      slug: (slug?.trim() || slugify(valueEn)) || null,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
  });
}

/** Edit a value's slug (auto-normalized). */
export async function updateAttributeValueSlug(id: string, slug: string) {
  await requirePermission('catalog.write');
  return prisma.attributeValue.update({ where: { id }, data: { slug: slugify(slug) || null } });
}

/** Reorder a value one step up/down within its attribute. Renumbers all
 *  siblings to 0..n-1 (self-healing — existing values all seed to sortOrder 0). */
export async function moveAttributeValue(id: string, dir: 'up' | 'down') {
  await requirePermission('catalog.write');
  const v = await prisma.attributeValue.findUnique({ where: { id } });
  if (!v) return;
  const siblings = await prisma.attributeValue.findMany({ where: { attributeId: v.attributeId }, orderBy: [{ sortOrder: 'asc' }, { valueEn: 'asc' }] });
  const i = siblings.findIndex((s) => s.id === id);
  const j = dir === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= siblings.length) return;
  [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
  await prisma.$transaction(siblings.map((s, idx) => prisma.attributeValue.update({ where: { id: s.id }, data: { sortOrder: idx } })));
}

export async function deleteAttributeValue(id: string) {
  await requirePermission('catalog.write');
  return prisma.attributeValue.delete({ where: { id } });
}
