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

/**
 * THE CUTOVER BOUNDARY.
 *
 * At the flip, veeey.net's lot quantities are whatever the WP-master sync last
 * wrote — i.e. WP's stock *already net of every order it had processed*. Ingesting
 * those same orders afterwards would subtract them a second time, and because the
 * poller's window covers hours of history that isn't gradual drift: it would read
 * as a catalog-wide stockout within one cron tick.
 *
 * Which timestamp gates which direction is not interchangeable:
 *   SALE    → **created**. Woo reserves stock when the order is PLACED, so a sale
 *             placed before the snapshot is in it, however late it's updated.
 *   RESTORE → **updated**. The put-back happens at the status change, so a
 *             pre-cutover order cancelled after the flip is a real, unbooked gain.
 *
 * A missing timestamp can't be placed either side of the line, so it does not
 * apply — being wrong here is silent and permanent, and a skipped row is visible
 * in the ledger.
 */
export function appliesAfterCutover(
  direction: IngestDirection,
  createdAt: Date | null | undefined,
  updatedAt: Date | null | undefined,
  cutover: Date | null,
): boolean {
  if (!cutover) return true; // no boundary configured — every movement counts
  const at = direction === 'SALE' ? createdAt : updatedAt;
  if (!(at instanceof Date) || Number.isNaN(at.getTime())) return false;
  return at.getTime() > cutover.getTime();
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
 * FEFO plan for an ev.net sale: take from the soonest expiry first, exactly as
 * veeey.net's own checkout does, so a unit sold on either site consumes the same
 * physical stock.
 *
 * A shortfall is REPORTED, not thrown. ev.net has already handed the goods over —
 * refusing the movement would leave veeey.net holding stock that no longer exists
 * and keep selling it. Taking what we can and surfacing the rest is the only
 * honest option; the remainder is a real discrepancy for the physical count.
 */
export type FefoLot = { id: string; qtyOnHand: number };
export type FefoTake = { lotId: string; qty: number };

export function planFefoTake(lots: FefoLot[], qty: number): { takes: FefoTake[]; shortfall: number } {
  let left = Math.max(0, Math.floor(qty));
  const takes: FefoTake[] = [];
  for (const l of lots) {
    if (left <= 0) break;
    const take = Math.min(left, Math.max(0, l.qtyOnHand));
    if (take <= 0) continue;
    takes.push({ lotId: l.id, qty: take });
    left -= take;
  }
  return { takes, shortfall: left };
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
