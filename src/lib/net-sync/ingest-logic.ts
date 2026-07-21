/**
 * Stage 2 (the inversion) — deciding what an **egyptvitamins.net** order does to
 * stock, so veeey.net can be the master while ev.net keeps selling.
 *
 * PURE (no DB/IO). This is the mirror of `writeback-logic`: that one decides
 * what leaves veeey.net for WP, this one decides what arrives from WP.
 *
 * 🔴 Nothing decided here may ever be written back to WP. WooCommerce already
 * decremented its own stock at the moment of sale; echoing it would subtract the
 * same unit twice. The `WpStockIngest` ledger exists precisely to keep these
 * movements separable from veeey.net-origin ones.
 */

/** WooCommerce statuses in which the goods have left (or are committed to leave). */
const SOLD = new Set(['processing', 'completed', 'shipped', 'on-hold', 'cash-delivered', 'card-delivered']);
/** Statuses meaning the sale came undone and the units are back on the shelf. */
const RETURNED = new Set(['cancelled', 'refunded', 'failed']);

export type IngestDirection = 'SALE' | 'RESTORE';

export const normalizeWpStatus = (s: string | null | undefined): string =>
  (s ?? '').trim().toLowerCase().replace(/^wc-/, '');

/**
 * What this WP status means for our stock — null = it says nothing yet
 * (`pending`, `checkout-draft`: no commitment, so no movement).
 *
 * Deliberately conservative at the edges: `on-hold` counts as SOLD because Woo
 * reduces stock when the order is placed, not when it ships. Treating it as "not
 * yet sold" would let veeey.net resell a unit ev.net has already set aside.
 */
export function directionForWpStatus(status: string | null | undefined): IngestDirection | null {
  const s = normalizeWpStatus(status);
  if (SOLD.has(s)) return 'SALE';
  if (RETURNED.has(s)) return 'RESTORE';
  return null;
}

export type WpLine = { wpId: number | null; qty: number };
export type WpDelta = { wpId: number; qty: number };

/**
 * Collapse an order's lines into one positive delta per product. Lines with no
 * WP id or a non-positive quantity are dropped — a delta we can't attribute to a
 * product is worse than no delta, because it would silently skew a reconciliation.
 */
export function linesToIngestDeltas(lines: WpLine[]): WpDelta[] {
  const by = new Map<number, number>();
  for (const l of lines) {
    if (l.wpId == null || !Number.isFinite(l.wpId)) continue;
    const qty = Math.floor(Number(l.qty) || 0);
    if (qty <= 0) continue;
    by.set(l.wpId, (by.get(l.wpId) ?? 0) + qty);
  }
  return [...by.entries()]
    .map(([wpId, qty]) => ({ wpId, qty }))
    .sort((a, b) => a.wpId - b.wpId); // deterministic → reconciliations are comparable
}

/**
 * Net movement per product across many ingested rows: SALE reduces what we hold,
 * RESTORE puts it back. Used by the reconciliation report to say "since the last
 * snapshot, ev.net consumed N of this product".
 */
export function netUnits(rows: { wpId: number; qty: number; direction: string }[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const r of rows) {
    const signed = r.direction === 'SALE' ? -r.qty : r.direction === 'RESTORE' ? r.qty : 0;
    if (signed) out.set(r.wpId, (out.get(r.wpId) ?? 0) + signed);
  }
  return out;
}
