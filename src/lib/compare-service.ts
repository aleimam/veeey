import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';

/** Compare (FR-CMP-*). Up to 4 products, attribute-aligned. Guest-friendly via a
 *  cookie session (persisted server-side so it survives reloads). */
const COMPARE_COOKIE = 'veeey-compare';
const MAX_COMPARE = 4;

export async function readCompareId(): Promise<string | null> {
  const c = await cookies();
  return c.get(COMPARE_COOKIE)?.value ?? null;
}

export async function ensureCompareId(): Promise<string> {
  const c = await cookies();
  let id = c.get(COMPARE_COOKIE)?.value;
  if (!id) {
    id = randomUUID();
    c.set(COMPARE_COOKIE, id, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
  }
  return id;
}

export async function toggleCompare(compareId: string, productId: string): Promise<{ added: boolean; count: number; full: boolean }> {
  const list = await prisma.compareList.upsert({ where: { sessionId: compareId }, update: {}, create: { sessionId: compareId }, include: { items: true } });
  const existing = list.items.find((i) => i.productId === productId);
  if (existing) {
    await prisma.compareItem.delete({ where: { id: existing.id } });
    return { added: false, count: list.items.length - 1, full: false };
  }
  if (list.items.length >= MAX_COMPARE) return { added: false, count: list.items.length, full: true };
  await prisma.compareItem.create({ data: { listId: list.id, productId } });
  return { added: true, count: list.items.length + 1, full: false };
}

export async function compareProductIds(compareId: string): Promise<string[]> {
  const list = await prisma.compareList.findUnique({ where: { sessionId: compareId }, include: { items: { select: { productId: true } } } });
  return list?.items.map((i) => i.productId) ?? [];
}

export async function getCompareProducts(compareId: string) {
  const ids = await compareProductIds(compareId);
  if (ids.length === 0) return [];
  return prisma.product.findMany({
    where: { id: { in: ids } },
    include: { brand: true, images: { take: 1, orderBy: { sortOrder: 'asc' } }, attributeValues: { include: { attributeValue: { include: { attribute: true } } } }, lots: { where: { status: 'LIVE' }, orderBy: { expiryDate: 'asc' } } },
  });
}
