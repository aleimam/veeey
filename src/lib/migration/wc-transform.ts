/**
 * Pure WooCommerce → Veeey analysis for the migration dry-run. Each function
 * inspects a raw WC record and returns the issues that would arise on import —
 * gaps (Veeey needs it, WC lacks it), transforms, intentional drops, decisions,
 * and hard validation errors. No DB / network here so it's unit-testable and the
 * dry-run can run it over fetched pages. Nothing is written.
 */

export type FlagCode =
  // products
  | 'sku_regenerated'
  | 'missing_ar'
  | 'missing_weight'
  | 'missing_gtin'
  | 'sale_to_lot'
  | 'status_draft'
  | 'categories_over_max'
  | 'kind_unknown'
  // customers
  | 'password_not_migratable'
  | 'missing_phone'
  | 'missing_city'
  // orders
  | 'currency_not_egp'
  | 'guest_order'
  | 'status_unmapped'
  | 'no_lot_binding'
  // shared
  | 'validation_error';

export type Analysis = { ok: boolean; key: string; flags: FlagCode[]; errorDetail?: string };

const str = (v: unknown): string => (v == null ? '' : typeof v === 'object' ? '' : String(v));
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});

/** Parse a WooCommerce money string (float EGP) to integer piastres, or null. */
export function egpToPiastres(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

const hasArabic = (s: string) => /[؀-ۿ]/.test(s);

/** WooCommerce core order statuses (without the `wc-` prefix). Anything else = custom → decision. */
export const KNOWN_WC_ORDER_STATUSES = new Set(['pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed', 'checkout-draft', 'trash']);

export function analyzeProduct(p: Record<string, unknown>): Analysis {
  const flags: FlagCode[] = [];
  const key = str(p.id);

  // SKU is always regenerated (WC SKUs are numeric WP IDs / dup / missing).
  flags.push('sku_regenerated');
  // Veeey has no product kind in WC.
  flags.push('kind_unknown');

  if (!hasArabic(str(p.name))) flags.push('missing_ar');
  if (egpToPiastres(p.weight) == null) flags.push('missing_weight');
  if (!str(p.global_unique_id) && !str(p.gtin) && !str(p.sku).match(/^\d{8,14}$/)) flags.push('missing_gtin');
  if (str(p.sale_price)) flags.push('sale_to_lot');
  if (str(p.status) === 'draft') flags.push('status_draft');
  if (arr(p.categories).length > 4) flags.push('categories_over_max');

  const price = egpToPiastres(p.regular_price ?? p.price);
  const ok = price != null;
  if (!ok) flags.push('validation_error');
  return { ok, key, flags, errorDetail: ok ? undefined : 'missing/invalid price' };
}

export function analyzeCustomer(c: Record<string, unknown>): Analysis {
  const flags: FlagCode[] = [];
  const key = str(c.id);
  const billing = obj(c.billing);

  flags.push('password_not_migratable');
  if (!str(billing.phone)) flags.push('missing_phone');
  if (!str(billing.city)) flags.push('missing_city');

  const ok = !!str(c.email);
  if (!ok) flags.push('validation_error');
  return { ok, key, flags, errorDetail: ok ? undefined : 'missing email' };
}

export function analyzeOrder(o: Record<string, unknown>): Analysis {
  const flags: FlagCode[] = [];
  const key = str(o.number) || str(o.id);

  if (str(o.currency).toUpperCase() !== 'EGP') flags.push('currency_not_egp');
  const customerId = Number(o.customer_id ?? 0);
  if (!customerId) flags.push('guest_order');
  if (!KNOWN_WC_ORDER_STATUSES.has(str(o.status))) flags.push('status_unmapped');
  if (arr(o.line_items).length > 0) flags.push('no_lot_binding');

  const total = egpToPiastres(o.total);
  const ok = total != null;
  if (!ok) flags.push('validation_error');
  return { ok, key, flags, errorDetail: ok ? undefined : 'missing/invalid total' };
}
