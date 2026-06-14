import { prisma } from '@/lib/prisma';
import type { FeedProduct } from '@/lib/feed-xml';

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://veeey.com';

/** Published products as feed rows (FR-FEED-01). Availability is derived from
 *  live lot stock; price from base price (per-tier feed pricing is future work). */
export async function feedProducts(locale = 'en'): Promise<FeedProduct[]> {
  const products = await prisma.product.findMany({
    where: { status: 'PUBLISHED' },
    include: {
      brand: { select: { nameEn: true } },
      images: { take: 1, orderBy: { sortOrder: 'asc' } },
      lots: { where: { status: 'LIVE' }, select: { qtyOnHand: true } },
    },
    take: 5000,
  });

  const abs = (url: string | undefined) => (url ? (url.startsWith('http') ? url : `${SITE_URL}${url}`) : null);

  return products.map((p) => ({
    sku: p.sku,
    gtin: p.gtin,
    title: p.nameEn,
    description: p.shortDescEn ?? p.nameEn,
    link: `${SITE_URL}/${locale}/products/${p.slugEn}`,
    imageLink: abs(p.images[0]?.url),
    pricePiastres: Number(p.basePricePiastres),
    brand: p.brand?.nameEn ?? null,
    inStock: p.lots.some((l) => l.qtyOnHand > 0),
  }));
}
