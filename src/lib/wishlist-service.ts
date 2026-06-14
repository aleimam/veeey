import { prisma } from '@/lib/prisma';
import { cardProductInclude } from '@/lib/storefront';

/** Wishlist (FR-WSH-*). Per-customer named lists; each item carries price-drop +
 *  back-in-stock alert flags (default on). Alerts fan out from ProductChangeEvents
 *  in P12; here we manage membership + flags. */

export async function getDefaultList(customerId: string) {
  const existing = await prisma.wishlistList.findFirst({ where: { customerId, isDefault: true } });
  if (existing) return existing;
  return prisma.wishlistList.create({ data: { customerId, name: 'My Wishlist', isDefault: true } });
}

export async function toggleWishlist(customerId: string, productId: string): Promise<boolean> {
  const list = await getDefaultList(customerId);
  const item = await prisma.wishlistItem.findUnique({ where: { listId_productId: { listId: list.id, productId } } });
  if (item) {
    await prisma.wishlistItem.delete({ where: { id: item.id } });
    return false;
  }
  await prisma.wishlistItem.create({ data: { listId: list.id, productId } });
  return true;
}

export async function wishlistedProductIds(customerId: string): Promise<Set<string>> {
  const items = await prisma.wishlistItem.findMany({ where: { list: { customerId } }, select: { productId: true } });
  return new Set(items.map((i) => i.productId));
}

export function getWishlistItems(customerId: string) {
  return prisma.wishlistItem.findMany({
    where: { list: { customerId } },
    include: { product: { include: cardProductInclude }, list: { select: { name: true } } },
    orderBy: { addedAt: 'desc' },
  });
}

export async function setItemAlerts(itemId: string, notifyPriceDrop: boolean, notifyBackInStock: boolean) {
  return prisma.wishlistItem.update({ where: { id: itemId }, data: { notifyPriceDrop, notifyBackInStock } });
}
