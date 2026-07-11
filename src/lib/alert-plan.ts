/**
 * Wishlist-alert planning (FR-WSH-02/03) — pure helpers for the sweep in
 * alert-service.ts. Keep this module import-clean (no prisma/auth) so it stays
 * unit-testable. Localizes the product name + deep link per customer and
 * dedupes fan-out targets within a sweep (a price change can raise several
 * events for the same product; a customer must get at most one alert per
 * product × alert-type per sweep).
 */

const SITE = 'https://veeey.com';

export type AlertEvent = {
  type: 'PRICE_DROP' | 'SALE_LOT' | 'BACK_IN_STOCK';
  newValue: string | null;
  product: { nameEn: string; nameAr: string | null; slugEn: string; slugAr: string | null };
};

export type AlertTarget = { customerId: string; email: string | null; locale: string };

/** Customer-locale product name + product URL (AR slug falls back to EN). */
export function alertVars(ev: AlertEvent, locale: string): Record<string, string> {
  const ar = locale === 'ar';
  const name = (ar ? ev.product.nameAr : ev.product.nameEn) || ev.product.nameEn;
  const slug = (ar ? ev.product.slugAr : ev.product.slugEn) || ev.product.slugEn;
  return {
    product: name,
    price: ev.newValue ?? '',
    link: `${SITE}/${ar ? 'ar' : 'en'}/products/${slug}`,
  };
}

/** PRICE_DROP and SALE_LOT are both "price dropped" to the customer. */
export const alertKind = (type: AlertEvent['type']): 'price' | 'stock' => (type === 'BACK_IN_STOCK' ? 'stock' : 'price');

/** Sweep-level dedupe key: one alert per customer × product × kind. */
export const alertDedupeKey = (customerId: string, productSlug: string, type: AlertEvent['type']): string =>
  `${customerId}:${productSlug}:${alertKind(type)}`;

/** Normalize a stored EGP value ("1234.5" / "1234") for display; '' if absent. */
export function formatAlertPrice(newValue: string | null): string {
  const n = Number(newValue);
  return Number.isFinite(n) && newValue != null && newValue !== '' ? n.toFixed(2).replace(/\.00$/, '') : '';
}
