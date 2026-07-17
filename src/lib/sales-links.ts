import { ymd } from '@/lib/analytics-range';

/**
 * The links out of the Sales page (V6 audit S13) — CSV exports and Orders
 * drill-throughs. Pure and in one place because both must carry the window the
 * page is actually showing: V5 F20 shipped an export that silently covered a
 * different range than the screen, and a drill-through that lands on a
 * different row count is the same class of lie.
 */
export type SalesPanel = 'period' | 'customer-type' | 'order-size' | 'order-value-hist' | 'lifetime-hist' | 'trend' | 'top-products' | 'top-brands';
export type SalesWindow = { preset: string; from?: string; to?: string };

/** CSV for one panel, on the page's exact range. */
export const salesExportHref = (panel: SalesPanel, w: SalesWindow): string => {
  const qs = new URLSearchParams({ report: 'sales', panel, preset: w.preset });
  if (w.from) qs.set('from', w.from);
  if (w.to) qs.set('to', w.to);
  return `/api/admin/analytics/export?${qs}`;
};

/**
 * Orders filtered to the same basis a Sales panel counts: placed in [start,
 * end] and not cancelled-like. `minTotal` is inclusive and `maxTotal`
 * exclusive (EGP), matching the big/normal split, so the two links partition
 * the period exactly as the cards do.
 *
 * Locale-relative: pass to next-intl's <Link>, which prepends the locale.
 */
export const salesOrdersHref = (start: Date, end: Date, bounds: { minTotal?: number; maxTotal?: number; productId?: string } = {}): string => {
  const qs = new URLSearchParams({ status: 'booked', from: ymd(start), to: ymd(end) });
  if (bounds.minTotal != null) qs.set('minTotal', String(bounds.minTotal));
  if (bounds.maxTotal != null) qs.set('maxTotal', String(bounds.maxTotal));
  if (bounds.productId) qs.set('productId', bounds.productId);
  return `/admin/orders?${qs}`;
};
