import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { Prisma as PrismaRt } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { uniqueSlug } from '@/lib/slug';
import { buildRuleWhere, parseRule, hasConditions, ruleOrderBy, type RuleConfig } from '@/lib/collection-rules';

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
  coverImage: z.string().trim().optional().nullable(),
  authorName: z.string().trim().max(80).optional().nullable(),
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
    coverImage: d.coverImage || null, authorName: d.authorName || null,
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
  descriptionAr: z.string().optional().nullable(),
  type: z.enum(['MANUAL', 'AUTO']).default('MANUAL'),
  ruleCategoryId: z.string().optional().nullable(),
  ruleTagSlug: z.string().optional().nullable(),
  rule: z.unknown().optional().nullable(), // structured condition builder (parsed via parseRule)
  status: STATUS.default('DRAFT'),
  sortOrder: z.number().int().default(0),
  productIds: z.array(z.string()).default([]),
  imageUrl: z.string().optional().nullable(),
  imageAltEn: z.string().optional().nullable(),
  imageAltAr: z.string().optional().nullable(),
  metaTitleEn: z.string().optional().nullable(),
  metaTitleAr: z.string().optional().nullable(),
  metaDescEn: z.string().optional().nullable(),
  metaDescAr: z.string().optional().nullable(),
});
export type CollectionInput = z.input<typeof collectionSchema>;

export const listCollections = () => prisma.collection.findMany({ orderBy: { sortOrder: 'asc' } });

/** Reconcile the stored display order with actual membership: keep manualOrder
 *  entries that are still members, then append any members it doesn't list. */
function orderedIds(manualOrder: string[], memberIds: string[]): string[] {
  const members = new Set(memberIds);
  const ordered = manualOrder.filter((pid) => members.has(pid));
  const seen = new Set(ordered);
  for (const pid of memberIds) if (!seen.has(pid)) ordered.push(pid);
  return ordered;
}

export async function getCollection(id: string) {
  const c = await prisma.collection.findUnique({ where: { id }, include: { products: { select: { id: true } } } });
  if (!c) return null;
  return { ...c, orderedProductIds: orderedIds(c.manualOrder, c.products.map((p) => p.id)) };
}

/** Storefront: a PUBLISHED collection by slug (+ its ordered manual ids), or null. */
export async function getPublishedCollectionBySlug(slug: string) {
  const c = await prisma.collection.findFirst({ where: { slug, status: 'PUBLISHED' }, include: { products: { select: { id: true } } } });
  if (!c) return null;
  return { ...c, orderedProductIds: orderedIds(c.manualOrder, c.products.map((p) => p.id)) };
}

/** Storefront: published collections for the index page (with sortOrder). */
export const listPublishedCollections = () =>
  prisma.collection.findMany({ where: { status: 'PUBLISHED' }, orderBy: [{ sortOrder: 'asc' }, { titleEn: 'asc' }] });

/** Product where-clause for an AUTO collection: prefer the structured ruleJson,
 *  else the legacy single category + tag slug. Shared by admin + storefront. */
export function collectionRuleWhere(c: { ruleJson: Prisma.JsonValue | null; ruleCategoryId: string | null; ruleTagSlug: string | null }): Prisma.ProductWhereInput {
  const rule = parseRule(c.ruleJson);
  if (hasConditions(rule)) return buildRuleWhere(rule);
  return {
    ...(c.ruleCategoryId ? { categories: { some: { id: c.ruleCategoryId } } } : {}),
    ...(c.ruleTagSlug ? { tags: { some: { slug: c.ruleTagSlug } } } : {}),
  };
}

/** Product order-by for an AUTO collection (from the rule's sort). */
export const collectionRuleOrderBy = (c: { ruleJson: Prisma.JsonValue | null }): Prisma.ProductOrderByWithRelationInput => ruleOrderBy(parseRule(c.ruleJson).sort);

/** Admin preview: how many PUBLISHED products a rule matches, + a small sample. */
export async function collectionMatchPreview(rule: RuleConfig, take = 8) {
  await requirePermission('content.manage');
  const where: Prisma.ProductWhereInput = { status: 'PUBLISHED', ...(hasConditions(rule) ? buildRuleWhere(rule) : {}) };
  const [count, sample] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({ where, select: { id: true, nameEn: true }, take, orderBy: { nameEn: 'asc' } }),
  ]);
  return { count, sample: sample.map((p) => p.nameEn) };
}

export async function saveCollection(id: string | null, raw: CollectionInput) {
  const user = await requirePermission('content.manage');
  const d = collectionSchema.parse(raw);
  const slug = await uniqueSlug(d.slug || d.titleEn, async (s) => {
    const found = await prisma.collection.findUnique({ where: { slug: s } });
    return !!found && found.id !== id;
  });
  const parsedRule = parseRule(d.rule);
  const ruleJson: Prisma.InputJsonValue | typeof PrismaRt.DbNull =
    d.type === 'AUTO' && hasConditions(parsedRule) ? (parsedRule as unknown as Prisma.InputJsonValue) : PrismaRt.DbNull;
  const base = {
    titleEn: d.titleEn, titleAr: d.titleAr ?? null, slug,
    descriptionEn: d.descriptionEn ?? null, descriptionAr: d.descriptionAr ?? null,
    type: d.type, status: d.status, sortOrder: d.sortOrder,
    ruleCategoryId: d.type === 'AUTO' ? d.ruleCategoryId || null : null,
    ruleTagSlug: d.type === 'AUTO' ? d.ruleTagSlug || null : null,
    ruleJson,
    // Manual: remember the picker's order; Automatic: order comes from the rule.
    manualOrder: d.type === 'MANUAL' ? d.productIds : [],
    imageUrl: d.imageUrl || null, imageAltEn: d.imageAltEn || null, imageAltAr: d.imageAltAr || null,
    metaTitleEn: d.metaTitleEn || null, metaTitleAr: d.metaTitleAr || null,
    metaDescEn: d.metaDescEn || null, metaDescAr: d.metaDescAr || null,
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

/** Resolve a collection's products (manual picks in saved order, or auto rule). */
export async function resolveCollectionProducts(id: string) {
  const c = await prisma.collection.findUnique({ where: { id }, include: { products: true } });
  if (!c) return [];
  if (c.type === 'MANUAL') {
    const order = orderedIds(c.manualOrder, c.products.map((p) => p.id));
    const byId = new Map(c.products.map((p) => [p.id, p]));
    return order.map((pid) => byId.get(pid)).filter((p): p is (typeof c.products)[number] => !!p);
  }
  return prisma.product.findMany({ where: { status: 'PUBLISHED', ...collectionRuleWhere(c) }, orderBy: ruleOrderBy(parseRule(c.ruleJson).sort), take: 100 });
}
