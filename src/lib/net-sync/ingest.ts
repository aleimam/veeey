import { prisma } from '@/lib/prisma';
import { directionForWpStatus, linesToIngestDeltas, netUnits, type WpLine } from '@/lib/net-sync/ingest-logic';

/**
 * Stage 2 (the inversion) — ingesting **egyptvitamins.net**'s own sales so
 * veeey.net can be the stock master while ev.net keeps selling the same pool.
 *
 * MODE (env `WP_INGEST_MODE`):
 *   'off'    — do nothing (default; safe on veeey.com, which has no WP peer).
 *   'shadow' — record what we WOULD apply, touch no lot. This is the week-long
 *              go/no-go gate: reconcile against WP's real stock daily, and only
 *              flip when the diff is consistently near zero.
 *   'apply'  — the inversion is live; recorded movements really move stock.
 *
 * 🔴 Ingested rows must NEVER reach the writeback. Woo already decremented WP's
 * own stock at the moment of sale, so echoing one subtracts the same unit twice.
 * Keeping them in `WpStockIngest` (not `NetStockOutbox`) is what enforces that.
 */

export type IngestMode = 'off' | 'shadow' | 'apply';

export function ingestMode(): IngestMode {
  const m = (process.env.WP_INGEST_MODE ?? '').trim().toLowerCase();
  return m === 'apply' ? 'apply' : m === 'shadow' ? 'shadow' : 'off';
}

export type WpOrderInput = {
  wpOrderId: number;
  orderNumber?: string | null;
  status: string | null;
  lines: WpLine[];
};

export type IngestResult = { recorded: number; direction: 'SALE' | 'RESTORE' | null; skipped?: string };

/**
 * Record the stock movement an ev.net order implies. Idempotent on
 * (wpOrderId, wpId, direction), because the webhook and the polling safety net
 * will both see the same sale and neither may double-count it.
 */
export async function ingestWpOrder(o: WpOrderInput): Promise<IngestResult> {
  const mode = ingestMode();
  if (mode === 'off') return { recorded: 0, direction: null, skipped: 'mode_off' };

  const direction = directionForWpStatus(o.status);
  // No commitment yet (pending / draft) — nothing to record. Recording a zero
  // would pollute the reconciliation with movements that never happened.
  if (!direction) return { recorded: 0, direction: null, skipped: 'no_movement' };

  const deltas = linesToIngestDeltas(o.lines);
  if (!deltas.length) return { recorded: 0, direction, skipped: 'no_lines' };

  // Resolve to Veeey products where we can. An unmatched wpId is still RECORDED
  // (productId null) — it's a real movement of real goods, and dropping it would
  // quietly understate what ev.net consumed.
  const wpIds = deltas.map((d) => d.wpId);
  const products = await prisma.product.findMany({
    where: { legacyWpId: { in: wpIds } },
    select: { id: true, legacyWpId: true },
  });
  const byWp = new Map(products.map((p) => [p.legacyWpId!, p.id]));

  const r = await prisma.wpStockIngest.createMany({
    data: deltas.map((d) => ({
      wpOrderId: o.wpOrderId,
      orderNumber: o.orderNumber ?? null,
      wpId: d.wpId,
      productId: byWp.get(d.wpId) ?? null,
      qty: d.qty,
      direction,
      status: mode === 'apply' ? 'APPLIED' : 'SHADOW',
      ...(mode === 'apply' ? { appliedAt: new Date() } : {}),
    })),
    skipDuplicates: true, // the webhook and the poller both see this order
  });

  return { recorded: r.count, direction };
}

/**
 * Reconciliation for the shadow-run gate.
 *
 * The question it answers is narrow and the only one that matters: **are we
 * capturing ev.net's sales completely and promptly?** Everything else that moves
 * veeey.net stock (its own orders, shipments, spillage) veeey.net already knows.
 *
 * Reports, never corrects — a reconciliation that silently fixes its own input
 * can't be used as evidence that the input was right.
 */
export type ReconcileRow = { wpId: number; productId: string | null; netUnits: number; rows: number };

export async function ingestReconcile(sinceHours = 24): Promise<{ since: Date; totalRows: number; products: ReconcileRow[] }> {
  const since = new Date(Date.now() - sinceHours * 3_600_000);
  const rows = await prisma.wpStockIngest.findMany({
    where: { createdAt: { gte: since } },
    select: { wpId: true, qty: true, direction: true, productId: true },
  });
  const net = netUnits(rows);
  const firstProduct = new Map<number, string | null>();
  const counts = new Map<number, number>();
  for (const r of rows) {
    if (!firstProduct.has(r.wpId)) firstProduct.set(r.wpId, r.productId);
    counts.set(r.wpId, (counts.get(r.wpId) ?? 0) + 1);
  }
  const products = [...net.entries()]
    .map(([wpId, n]) => ({ wpId, productId: firstProduct.get(wpId) ?? null, netUnits: n, rows: counts.get(wpId) ?? 0 }))
    .sort((a, b) => a.netUnits - b.netUnits); // biggest consumers first
  return { since, totalRows: rows.length, products };
}

/** Movements ev.net made that we could not attribute to a Veeey product. */
export function unmatchedIngestCount() {
  return prisma.wpStockIngest.count({ where: { productId: null } });
}
