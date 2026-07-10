/**
 * Pure classification engine for the two Inventory admin features:
 *   • Requests / "To-buy"     — which products we're short of and should reorder
 *   • Expiry Fight / "To-sell" — which lots are approaching expiry
 *
 * No DB access here. The service layer feeds these functions pre-aggregated
 * sales/stock numbers (see inventory-reorder-service.ts) so every rule is
 * unit-testable. All quantities are integer units; `now` is always passed in
 * for deterministic tests. Money is opaque (carried through, never computed).
 */

// ---------------------------------------------------------------------------
// Requests / To-buy
// ---------------------------------------------------------------------------

export interface ReorderInput {
  /** Sellable stock: Σ(qtyOnHand − qtyReserved) over LIVE, NEW lots, all locations. */
  stock: number;
  /** Units sold in the last 30 / 90 / 180 days (OrderItem.qty; incl. pre-order demand; excl. cancelled/refunded/lost). */
  units30: number;
  units90: number;
  units180: number;
  /** Featured = member of the Best Sellers collection. Widens the short-stock window to 180d. */
  featured: boolean;
  /** Units per week for the 6 weeks BEFORE the last 7 days (baseline for the running-fast spike test). */
  weeklyBaseline: number[];
  /** Units sold in the last 7 days. */
  units7: number;
  /** Units per month for the 6 months BEFORE the last 30 days (baseline for the running-fast spike test). */
  monthlyBaseline: number[];
  /** Open (unfulfilled) pre-order demand — OrderItem.preorder = true. Drives the Special-orders tab. */
  preorderUnits: number;
}

/** A product must sell at least this multiple of its baseline to count as "running fast". */
export const SPIKE_RATIO = 3;

/** Out of stock: nothing sellable on hand. */
export function isOutOfStock(i: Pick<ReorderInput, 'stock'>): boolean {
  return i.stock <= 0;
}

/** Last piece: exactly one sellable unit left. */
export function isLastPiece(i: Pick<ReorderInput, 'stock'>): boolean {
  return i.stock === 1;
}

/** Trailing-sales window a product is measured against: 180d if featured, else 90d. */
export function shortStockThreshold(i: Pick<ReorderInput, 'units90' | 'units180' | 'featured'>): number {
  return i.featured ? i.units180 : i.units90;
}

/** Short stock: still in stock, but below what we sold in the trailing window. */
export function isShortStock(i: Pick<ReorderInput, 'stock' | 'units90' | 'units180' | 'featured'>): boolean {
  return i.stock > 0 && i.stock < shortStockThreshold(i);
}

/** Arithmetic mean of a series; 0 for an empty series. */
export function average(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

/**
 * Running fast: recent demand ≥ SPIKE_RATIO× the preceding baseline average, on
 * either the weekly (last 7d vs the 6 weeks before) or the monthly (last 30d vs
 * the 6 months before) horizon. A zero baseline never qualifies — that avoids
 * flagging brand-new products with no history as a spike.
 */
export function isRunningFast(
  i: Pick<ReorderInput, 'units7' | 'weeklyBaseline' | 'units30' | 'monthlyBaseline'>,
): boolean {
  const weekBase = average(i.weeklyBaseline);
  const monthBase = average(i.monthlyBaseline);
  const weekSpike = weekBase > 0 && i.units7 >= SPIKE_RATIO * weekBase;
  const monthSpike = monthBase > 0 && i.units30 >= SPIKE_RATIO * monthBase;
  return weekSpike || monthSpike;
}

/** Awaiting-stock pre-orders exist → belongs on the Special-orders tab. */
export function hasSpecialOrders(i: Pick<ReorderInput, 'preorderUnits'>): boolean {
  return i.preorderUnits > 0;
}

export type ReorderTab = 'out_of_stock' | 'last_piece' | 'short_stock' | 'running_fast' | 'special_orders';

export const REORDER_TABS: ReorderTab[] = [
  'out_of_stock',
  'last_piece',
  'short_stock',
  'running_fast',
  'special_orders',
];

/** Every To-buy tab a product currently qualifies for (tabs overlap by design). */
export function reorderTabs(i: ReorderInput): ReorderTab[] {
  const tabs: ReorderTab[] = [];
  if (isOutOfStock(i)) tabs.push('out_of_stock');
  if (isLastPiece(i)) tabs.push('last_piece');
  if (isShortStock(i)) tabs.push('short_stock');
  if (isRunningFast(i)) tabs.push('running_fast');
  if (hasSpecialOrders(i)) tabs.push('special_orders');
  return tabs;
}

/**
 * Suggested reorder quantity: cover the trailing-90-day run-rate, net of what is
 * already on hand and already incoming, floored at 1.
 */
export function suggestedReorderQty(i: { units90: number; stock: number; incoming?: number }): number {
  return Math.max(1, Math.ceil(i.units90 - i.stock - (i.incoming ?? 0)));
}

// ---------------------------------------------------------------------------
// Expiry Fight / To-sell
// ---------------------------------------------------------------------------

export type ExpiryTab = 'this_month' | 'next_month' | 'quarter' | 'bi_annual' | 'year';

export const EXPIRY_TABS: ExpiryTab[] = ['this_month', 'next_month', 'quarter', 'bi_annual', 'year'];

/** UTC midnight on the 1st of the month `monthsAhead` from `now`. */
function startOfMonthUTC(now: Date, monthsAhead: number): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthsAhead, 1, 0, 0, 0, 0));
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
}

/**
 * Which expiry tabs a lot's expiry date falls into. `this_month`/`next_month`
 * are calendar buckets; `quarter`/`bi_annual`/`year` are rolling next-90/180/365
 * day windows from `now` and are cumulative (each includes the nearer ones).
 * Already-expired lots (expiry < now) match nothing. Pass `now` = start of today
 * if you want lots expiring earlier today to still count.
 */
export function expiryTabs(expiry: Date, now: Date): ExpiryTab[] {
  if (expiry.getTime() < now.getTime()) return [];
  const tabs: ExpiryTab[] = [];
  const startNextMonth = startOfMonthUTC(now, 1);
  const startMonthAfter = startOfMonthUTC(now, 2);
  if (expiry.getTime() < startNextMonth.getTime()) tabs.push('this_month');
  else if (expiry.getTime() < startMonthAfter.getTime()) tabs.push('next_month');
  if (expiry.getTime() < addDays(now, 90).getTime()) tabs.push('quarter');
  if (expiry.getTime() < addDays(now, 180).getTime()) tabs.push('bi_annual');
  if (expiry.getTime() < addDays(now, 365).getTime()) tabs.push('year');
  return tabs;
}

/** True if the lot expires within the longest (365-day) horizon and isn't already expired. */
export function inExpiryHorizon(expiry: Date, now: Date): boolean {
  return expiryTabs(expiry, now).length > 0;
}

/** The N nearest-expiry lots (ascending expiry). Callers exclude non-positive-stock lots first. */
export function shortestExpiries<T extends { expiry: Date }>(lots: T[], n = 3): T[] {
  return [...lots].sort((a, b) => a.expiry.getTime() - b.expiry.getTime()).slice(0, n);
}
