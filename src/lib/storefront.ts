import type { Product as CardProduct } from '@/components/storefront/product-card';

/**
 * Storefront read helpers — map DB products to the locked v0 ProductCard view
 * model, applying FEFO + price-per-expiry (nearest-expiry lot drives the shown
 * expiry; a flagged sale lot shows the discounted price with the base struck through).
 */

export type DbCardProduct = {
  id: string;
  slugEn: string;
  slugAr: string | null;
  nameEn: string;
  nameAr: string | null;
  basePricePiastres: bigint;
  ratingAvg: number | null;
  ratingCount: number;
  brand: { nameEn: string } | null;
  images: { url: string }[];
  lots: { expiryDate: Date | null; saleFlag: boolean; priceOverridePiastres: bigint | null }[];
};

export const cardProductInclude = {
  brand: true,
  images: { take: 1, orderBy: { sortOrder: 'asc' } },
  lots: { where: { status: 'LIVE' }, orderBy: { expiryDate: 'asc' } },
} as const;

/** A product has sellable live stock. */
export const inStockWhere = { lots: { some: { status: 'LIVE' as const, qtyOnHand: { gt: 0 } } } };
/**
 * Storefront visibility (FR-CAT). On top of `status: 'PUBLISHED'`, the customer
 * only sees products that are in stock OR flagged pre-order — out-of-stock,
 * non-preorder products stay published (admin/SEO/direct link) but are hidden
 * from listings/search/home/feed. Merge as `AND: [visibleProductWhere]` so it
 * composes with any existing OR in the query.
 */
export const visibleProductWhere = { OR: [inStockWhere, { preorderEnabled: true }] };

function monthYear(d: Date): string {
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

export function toCardProduct(p: DbCardProduct, locale: string): CardProduct {
  const nearest = p.lots[0];
  const saleLot = p.lots.find((l) => l.saleFlag && l.priceOverridePiastres != null);
  const pricePiastres = Number(saleLot?.priceOverridePiastres ?? p.basePricePiastres);
  const oldPricePiastres = saleLot ? Number(p.basePricePiastres) : undefined;

  return {
    id: p.id,
    slug: (locale === 'ar' ? p.slugAr : p.slugEn) ?? p.slugEn,
    brand: p.brand?.nameEn ?? '',
    name: (locale === 'ar' ? p.nameAr : p.nameEn) ?? p.nameEn,
    image: p.images[0]?.url ?? '/placeholder.svg',
    rating: p.ratingAvg ?? 0,
    reviews: p.ratingCount,
    expiry: nearest ? (nearest.expiryDate ? `Exp ${monthYear(nearest.expiryDate)}` : 'No expiry') : 'Pre-order',
    pricePiastres,
    oldPricePiastres,
    points: Math.round(pricePiastres / 100), // default 1 pt / EGP
    badge: saleLot
      ? { type: 'short-expiry', label: 'Short expiry' }
      : !nearest
        ? { type: 'pre-order', label: 'Pre-order · 25% deposit' }
        : undefined,
  };
}
