import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { uniqueSlug } from '@/lib/slug';

/** CMS pages, blog, and curated collections (FR-CMS-*, FR-CAT-03). */

const STATUS = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);

// ---- CMS pages -------------------------------------------------------------
const pageSchema = z.object({
  titleEn: z.string().trim().min(1),
  titleAr: z.string().trim().optional().nullable(),
  slug: z.string().trim().optional(),
  bodyEn: z.string().optional().nullable(),
  bodyAr: z.string().optional().nullable(),
  status: STATUS.default('DRAFT'),
  metaTitleEn: z.string().optional().nullable(),
  metaDescEn: z.string().optional().nullable(),
});
export type PageInput = z.input<typeof pageSchema>;

export const listPages = () => prisma.cmsPage.findMany({ orderBy: { updatedAt: 'desc' } });
export const getPage = (id: string) => prisma.cmsPage.findUnique({ where: { id } });

export async function savePage(id: string | null, raw: PageInput) {
  const user = await requirePermission('content.manage');
  const d = pageSchema.parse(raw);
  const slug = await uniqueSlug(d.slug || d.titleEn, async (s) => {
    const found = await prisma.cmsPage.findUnique({ where: { slug: s } });
    return !!found && found.id !== id;
  });
  const data = {
    titleEn: d.titleEn, titleAr: d.titleAr ?? null, slug,
    bodyEn: d.bodyEn ?? null, bodyAr: d.bodyAr ?? null, status: d.status,
    metaTitleEn: d.metaTitleEn ?? null, metaDescEn: d.metaDescEn ?? null,
  };
  const page = id ? await prisma.cmsPage.update({ where: { id }, data }) : await prisma.cmsPage.create({ data });
  await audit({ actorType: 'USER', actorId: user.id, action: id ? 'page.update' : 'page.create', entityType: 'CmsPage', entityId: page.id });
  return page;
}

// ---- Blog posts ------------------------------------------------------------
const postSchema = z.object({
  titleEn: z.string().trim().min(1),
  titleAr: z.string().trim().optional().nullable(),
  slug: z.string().trim().optional(),
  excerptEn: z.string().optional().nullable(),
  bodyEn: z.string().optional().nullable(),
  bodyAr: z.string().optional().nullable(),
  status: STATUS.default('DRAFT'),
});
export type PostInput = z.input<typeof postSchema>;

export const listPosts = () => prisma.blogPost.findMany({ orderBy: { updatedAt: 'desc' } });
export const getPost = (id: string) => prisma.blogPost.findUnique({ where: { id } });

export async function savePost(id: string | null, raw: PostInput) {
  const user = await requirePermission('content.manage');
  const d = postSchema.parse(raw);
  const slug = await uniqueSlug(d.slug || d.titleEn, async (s) => {
    const found = await prisma.blogPost.findUnique({ where: { slug: s } });
    return !!found && found.id !== id;
  });
  const data = {
    titleEn: d.titleEn, titleAr: d.titleAr ?? null, slug,
    excerptEn: d.excerptEn ?? null, bodyEn: d.bodyEn ?? null, bodyAr: d.bodyAr ?? null,
    status: d.status, publishedAt: d.status === 'PUBLISHED' ? new Date() : null,
  };
  const post = id ? await prisma.blogPost.update({ where: { id }, data }) : await prisma.blogPost.create({ data });
  await audit({ actorType: 'USER', actorId: user.id, action: id ? 'post.update' : 'post.create', entityType: 'BlogPost', entityId: post.id });
  return post;
}

// ---- Collections (FR-CAT-03) -----------------------------------------------
const collectionSchema = z.object({
  titleEn: z.string().trim().min(1),
  titleAr: z.string().trim().optional().nullable(),
  slug: z.string().trim().optional(),
  descriptionEn: z.string().optional().nullable(),
  type: z.enum(['MANUAL', 'AUTO']).default('MANUAL'),
  ruleCategoryId: z.string().optional().nullable(),
  ruleTagSlug: z.string().optional().nullable(),
  status: STATUS.default('DRAFT'),
  productIds: z.array(z.string()).default([]),
});
export type CollectionInput = z.input<typeof collectionSchema>;

export const listCollections = () => prisma.collection.findMany({ orderBy: { sortOrder: 'asc' } });
export const getCollection = (id: string) =>
  prisma.collection.findUnique({ where: { id }, include: { products: { select: { id: true } } } });

export async function saveCollection(id: string | null, raw: CollectionInput) {
  const user = await requirePermission('content.manage');
  const d = collectionSchema.parse(raw);
  const slug = await uniqueSlug(d.slug || d.titleEn, async (s) => {
    const found = await prisma.collection.findUnique({ where: { slug: s } });
    return !!found && found.id !== id;
  });
  const base = {
    titleEn: d.titleEn, titleAr: d.titleAr ?? null, slug,
    descriptionEn: d.descriptionEn ?? null, type: d.type, status: d.status,
    ruleCategoryId: d.type === 'AUTO' ? d.ruleCategoryId || null : null,
    ruleTagSlug: d.type === 'AUTO' ? d.ruleTagSlug || null : null,
  };
  const picks = d.type === 'MANUAL' ? d.productIds.map((pid) => ({ id: pid })) : [];
  const collection = id
    ? await prisma.collection.update({
        where: { id },
        data: { ...base, ...(d.type === 'MANUAL' ? { products: { set: picks } } : {}) },
      })
    : await prisma.collection.create({
        data: { ...base, ...(picks.length ? { products: { connect: picks } } : {}) },
      });
  await audit({ actorType: 'USER', actorId: user.id, action: id ? 'collection.update' : 'collection.create', entityType: 'Collection', entityId: collection.id });
  return collection;
}

/** Resolve a collection's products (manual picks or auto rule). */
export async function resolveCollectionProducts(id: string) {
  const c = await prisma.collection.findUnique({ where: { id }, include: { products: true } });
  if (!c) return [];
  if (c.type === 'MANUAL') return c.products;
  return prisma.product.findMany({
    where: {
      status: 'PUBLISHED',
      ...(c.ruleCategoryId ? { categories: { some: { id: c.ruleCategoryId } } } : {}),
      ...(c.ruleTagSlug ? { tags: { some: { slug: c.ruleTagSlug } } } : {}),
    },
    take: 100,
  });
}
