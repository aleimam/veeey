/**
 * net-sync Phase 3 — PURE writeback decision logic (no DB imports → unit-testable).
 *
 * Owner decisions (2026-07-19): confirm-triggered · restore on cancel ·
 * v1 product-level deltas · 2-min drain. WP is the stock master; veeey.net
 * orders report back as DELTAS (never absolute stock) so staff edits in WP and
 * veeey.net sales commute.
 */

/** Statuses that commit stock: entering any of these (first time) = a sale. */
export const COMMITTED_STATUSES = ['CONFIRMED', 'SHIPPED', 'DELIVERED'] as const;

/** Statuses that un-commit a previously committed order = restore stock. */
export const CANCELLED_STATUSES = ['CANCELLED', 'REFUNDED'] as const;

const committed = (s: string) => (COMMITTED_STATUSES as readonly string[]).includes(s);
const cancelled = (s: string) => (CANCELLED_STATUSES as readonly string[]).includes(s);

/**
 * What a status transition means for the WP writeback:
 *  - 'SALE'    → enqueue -qty deltas (first entry into the committed set)
 *  - 'RESTORE' → enqueue +qty deltas (leaving committed for a cancel-like state)
 *  - null      → nothing (pre-confirm shuffling, or moves within the same class)
 * The exactly-once guarantee itself lives in the DB unique key — this only
 * classifies the transition.
 */
export function writebackAction(from: string, to: string): 'SALE' | 'RESTORE' | null {
  if (!committed(from) && committed(to)) return 'SALE';
  if (committed(from) && cancelled(to)) return 'RESTORE';
  return null;
}

/** Per-row sanity cap: a single line moving more units than this is refused
 *  (defense against a corrupted qty reaching the live WP store). */
export const MAX_DELTA_PER_ROW = 100;

/** Group order lines into per-WP-product positive deltas (skips non-WP products,
 *  merges duplicate lines, drops zero/negative qty, enforces the cap). */
export function linesToDeltas(
  lines: Array<{ wpId: number | null; qty: number }>,
): Array<{ wpId: number; qty: number }> {
  const byWp = new Map<number, number>();
  for (const l of lines) {
    if (l.wpId == null || !Number.isInteger(l.wpId) || l.wpId <= 0) continue;
    const q = Math.floor(l.qty);
    if (q <= 0) continue;
    byWp.set(l.wpId, (byWp.get(l.wpId) ?? 0) + q);
  }
  return [...byWp.entries()]
    .filter(([, qty]) => qty <= MAX_DELTA_PER_ROW)
    .map(([wpId, qty]) => ({ wpId, qty }));
}
