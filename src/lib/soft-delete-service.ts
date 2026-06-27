import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import type { PermissionKey } from '@/lib/permissions';

/**
 * Reversible soft-delete (archive/restore) + guarded hard-delete for admin
 * entities (FR-CAT/FR-CONTENT/FR-PROMO). Strategy by model:
 *   • Brand/Category/Tag/Attribute/Gift → nullable `archivedAt` timestamp.
 *   • Coupon → existing `active` flag.
 *   • Product/Collection/CmsPage/BlogPost → status enum (ARCHIVED ⇄ DRAFT).
 * Hard-delete is offered only when a record is not referenced anywhere
 * ("in use" → throws IN_USE so the UI can keep the archive instead).
 */

export class InUseError extends Error {
  constructor() {
    super('IN_USE');
    this.name = 'InUseError';
  }
}

async function logAction(perm: PermissionKey, action: string, entityType: string, entityId: string) {
  const user = await requirePermission(perm);
  await audit({ actorType: 'USER', actorId: user.id, action, entityType, entityId });
}

// ---- Brands ----------------------------------------------------------------
export async function archiveBrand(id: string, archived = true) {
  await logAction('catalog.write', archived ? 'brand.archive' : 'brand.restore', 'Brand', id);
  return prisma.brand.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
}
export async function deleteBrand(id: string) {
  const inUse = await prisma.product.count({ where: { brandId: id } });
  if (inUse > 0) throw new InUseError();
  await logAction('catalog.write', 'brand.delete', 'Brand', id);
  return prisma.brand.delete({ where: { id } });
}

// ---- Categories ------------------------------------------------------------
export async function archiveCategory(id: string, archived = true) {
  await logAction('catalog.write', archived ? 'category.archive' : 'category.restore', 'Category', id);
  return prisma.category.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
}
export async function deleteCategory(id: string) {
  const [products, children] = await Promise.all([
    prisma.product.count({ where: { categories: { some: { id } } } }),
    prisma.category.count({ where: { parentId: id } }),
  ]);
  if (products > 0 || children > 0) throw new InUseError();
  await logAction('catalog.write', 'category.delete', 'Category', id);
  return prisma.category.delete({ where: { id } });
}

// ---- Tags ------------------------------------------------------------------
export async function archiveTag(id: string, archived = true) {
  await logAction('catalog.write', archived ? 'tag.archive' : 'tag.restore', 'Tag', id);
  return prisma.tag.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
}
export async function deleteTag(id: string) {
  const inUse = await prisma.product.count({ where: { tags: { some: { id } } } });
  if (inUse > 0) throw new InUseError();
  await logAction('catalog.write', 'tag.delete', 'Tag', id);
  return prisma.tag.delete({ where: { id } });
}

// ---- Attributes ------------------------------------------------------------
export async function archiveAttribute(id: string, archived = true) {
  await logAction('catalog.write', archived ? 'attribute.archive' : 'attribute.restore', 'Attribute', id);
  return prisma.attribute.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
}
export async function deleteAttribute(id: string) {
  const inUse = await prisma.product.count({ where: { attributeValues: { some: { attributeValue: { attributeId: id } } } } });
  if (inUse > 0) throw new InUseError();
  await logAction('catalog.write', 'attribute.delete', 'Attribute', id);
  // AttributeValue rows cascade on Attribute delete (schema onDelete: Cascade).
  return prisma.attribute.delete({ where: { id } });
}

// ---- Coupons (uses `active` flag) ------------------------------------------
export async function archiveCoupon(id: string, archived = true) {
  await logAction('coupons.manage', archived ? 'coupon.archive' : 'coupon.restore', 'Coupon', id);
  return prisma.coupon.update({ where: { id }, data: { active: !archived } });
}
export async function deleteCoupon(id: string) {
  const inUse = await prisma.couponRedemption.count({ where: { couponId: id } });
  if (inUse > 0) throw new InUseError();
  await logAction('coupons.manage', 'coupon.delete', 'Coupon', id);
  return prisma.coupon.delete({ where: { id } });
}

// ---- Gifts -----------------------------------------------------------------
export async function archiveGift(id: string, archived = true) {
  await logAction('orders.write', archived ? 'gift.archive' : 'gift.restore', 'Gift', id);
  return prisma.gift.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
}
export async function deleteGift(id: string) {
  const inUse = await prisma.orderGift.count({ where: { giftId: id } });
  if (inUse > 0) throw new InUseError();
  await logAction('orders.write', 'gift.delete', 'Gift', id);
  return prisma.gift.delete({ where: { id } });
}

// ---- Collections (status enum) ---------------------------------------------
export async function archiveCollection(id: string, archived = true) {
  await logAction('content.manage', archived ? 'collection.archive' : 'collection.restore', 'Collection', id);
  return prisma.collection.update({ where: { id }, data: { status: archived ? 'ARCHIVED' : 'DRAFT' } });
}
export async function deleteCollection(id: string) {
  await logAction('content.manage', 'collection.delete', 'Collection', id);
  // CollectionProduct join rows cascade on delete (schema).
  return prisma.collection.delete({ where: { id } });
}

// ---- CMS pages (status enum) -----------------------------------------------
export async function archivePage(id: string, archived = true) {
  await logAction('content.manage', archived ? 'page.archive' : 'page.restore', 'CmsPage', id);
  return prisma.cmsPage.update({ where: { id }, data: { status: archived ? 'ARCHIVED' : 'DRAFT' } });
}
export async function deletePage(id: string) {
  await logAction('content.manage', 'page.delete', 'CmsPage', id);
  return prisma.cmsPage.delete({ where: { id } });
}

// ---- Blog posts (status enum) ----------------------------------------------
export async function archivePost(id: string, archived = true) {
  await logAction('content.manage', archived ? 'post.archive' : 'post.restore', 'BlogPost', id);
  return prisma.blogPost.update({ where: { id }, data: { status: archived ? 'ARCHIVED' : 'DRAFT' } });
}
export async function deletePost(id: string) {
  await logAction('content.manage', 'post.delete', 'BlogPost', id);
  return prisma.blogPost.delete({ where: { id } });
}

// ---- Generic bulk archive/restore/delete --------------------------------------
type ArchiveFn = (id: string, archived: boolean) => Promise<unknown>;
type DeleteFn = (id: string) => Promise<unknown>;

const BULK_ARCHIVERS: Record<string, ArchiveFn> = {
  brand: archiveBrand, category: archiveCategory, tag: archiveTag, attribute: archiveAttribute,
  coupon: archiveCoupon, gift: archiveGift, collection: archiveCollection, page: archivePage, post: archivePost,
};
const BULK_DELETERS: Record<string, DeleteFn> = {
  brand: deleteBrand, category: deleteCategory, tag: deleteTag, attribute: deleteAttribute,
  coupon: deleteCoupon, gift: deleteGift, collection: deleteCollection, page: deletePage, post: deletePost,
};

/** Apply archive / restore / delete to many ids. Each underlying fn does its own
 *  RBAC + audit; in-use deletes throw and are counted as skipped (not fatal). */
export async function bulkSoftDelete(entity: string, op: 'archive' | 'restore' | 'delete', ids: string[]): Promise<{ affected: number; skipped: number }> {
  let affected = 0, skipped = 0;
  if (op === 'delete') {
    const fn = BULK_DELETERS[entity];
    if (!fn) throw new Error('BAD_ENTITY');
    for (const id of ids) { try { await fn(id); affected++; } catch { skipped++; } }
  } else {
    const fn = BULK_ARCHIVERS[entity];
    if (!fn) throw new Error('BAD_ENTITY');
    for (const id of ids) { try { await fn(id, op === 'archive'); affected++; } catch { skipped++; } }
  }
  return { affected, skipped };
}

// ---- Products (status enum; archive lives in catalog-service.setProductStatus) ----
export async function deleteProduct(id: string) {
  const [items, lots] = await Promise.all([
    prisma.orderItem.count({ where: { productId: id } }),
    prisma.lot.count({ where: { productId: id } }),
  ]);
  if (items > 0 || lots > 0) throw new InUseError();
  await logAction('catalog.write', 'product.delete', 'Product', id);
  return prisma.product.delete({ where: { id } });
}
