'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import type { Prisma } from '@/generated/prisma/client';

/** Lightweight product hit for the collection manual picker (V3-COL-2). */
export type PickerProduct = { id: string; name: string; sku: string; brand: string | null; thumb: string | null };

const toHit = (p: { id: string; nameEn: string; sku: string; brand: { nameEn: string } | null; images: { url: string }[] }): PickerProduct => ({
  id: p.id, name: p.nameEn, sku: p.sku, brand: p.brand?.nameEn ?? null, thumb: p.images[0]?.url ?? null,
});

const pickerInclude = {
  brand: { select: { nameEn: true } },
  images: { orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }], take: 1 },
};

/** Search products by name / SKU / brand for the manual collection picker. */
export async function searchCollectionProductsAction(q: string): Promise<PickerProduct[]> {
  await requirePermission('content.manage');
  const term = q.trim();
  if (term.length < 2) return [];
  const or: Prisma.ProductWhereInput[] = [
    { nameEn: { contains: term, mode: 'insensitive' } },
    { nameAr: { contains: term } },
    { sku: { contains: term, mode: 'insensitive' } },
    { brand: { nameEn: { contains: term, mode: 'insensitive' } } },
  ];
  const rows = await prisma.product.findMany({
    where: { status: { in: ['PUBLISHED', 'PRIVATE', 'DRAFT'] }, OR: or },
    include: pickerInclude,
    orderBy: { nameEn: 'asc' },
    take: 15,
  });
  return rows.map(toHit);
}

/** Hydrate a set of product ids into ordered picker hits (for form defaults). */
export async function hydratePickerProducts(ids: string[]): Promise<PickerProduct[]> {
  if (!ids.length) return [];
  const rows = await prisma.product.findMany({ where: { id: { in: ids } }, include: pickerInclude });
  const byId = new Map(rows.map((p) => [p.id, toHit(p)]));
  return ids.map((id) => byId.get(id)).filter((p): p is PickerProduct => !!p);
}
