import { prisma } from '@/lib/prisma';
import { appliesAfterCutover, directionForWpStatus, linesToIngestDeltas, netUnits, type WpLine } from '@/lib/net-sync/ingest-logic';
import { applyIngestMovement } from '@/lib/net-sync/ingest-apply';

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

/**
 * The flip's cutover instant (env `WP_INGEST_SINCE`, ISO-8601).
 *
 * Set it to the moment veeey.net stopped taking its stock from WP. Orders on the
 * snapshot's side of the line are recorded PRE_CUTOVER and never applied — their
 * effect is already inside the quantities we imported. See `appliesAfterCutover`
 * for why SALE and RESTORE are judged on different timestamps.
 */
export function ingestCutover(): Date | null {
  const raw = (process.env.WP_INGEST_SINCE ?? '').trim();
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type WpOrderInput = {
  wpOrderId: number;
  orderNumber?: string | null;
  status: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  lines: WpLine[];
};

export type IngestResult = {
  recorded: number;
  direction: 'SALE' | 'RESTORE' | null;
  moved: number;
  shortfall: number;
  duplicates: number;
  skipped?: string;
};

/**
 * Record — and in `apply` mode actually make — the stock movement an ev.net order
 * implies.
 *
 * Idempotent on (wpOrderId, wpId, direction): the webhook and the polling safety
 * net both see the same sale, an order visited twice in one window is normal, and
 * neither may double-count. The row IS the idempotency token, so it is written in
 * the same transaction as the movement — a token without its movement would
 * suppress the retry forever, and a movement without its token would be applied
 * again on the next tick.
 */
export async function ingestWpOrder(o: WpOrderInput): Promise<IngestResult> {
  const empty = { recorded: 0, moved: 0, shortfall: 0, duplicates: 0 };
  const mode = ingestMode();
  if (mode === 'off') return { ...empty, direction: null, skipped: 'mode_off' };

  const direction = directionForWpStatus(o.status);
  // No commitment yet (pending / draft) — nothing to record. Recording a zero
  // would pollute the reconciliation with movements that never happened.
  if (!direction) return { ...empty, direction: null, skipped: 'no_movement' };

  const deltas = linesToIngestDeltas(o.lines);
  if (!deltas.length) return { ...empty, direction, skipped: 'no_lines' };

  // Resolve to Veeey products where we can. An unmatched wpId is still RECORDED
  // (productId null) — it's a real movement of real goods, and dropping it would
  // quietly understate what ev.net consumed.
  const wpIds = deltas.map((d) => d.wpId);
  const products = await prisma.product.findMany({
    where: { legacyWpId: { in: wpIds } },
    select: { id: true, legacyWpId: true },
  });
  const byWp = new Map(products.map((p) => [p.legacyWpId!, p.id]));

  const live = mode === 'apply' && appliesAfterCutover(direction, o.createdAt, o.updatedAt, ingestCutover());
  const status = mode !== 'apply' ? 'SHADOW' : live ? 'APPLIED' : 'PRE_CUTOVER';

  const res = { ...empty, direction } as IngestResult;
  for (const d of deltas) {
    const productId = byWp.get(d.wpId) ?? null;
    const base = {
      wpOrderId: o.wpOrderId, orderNumber: o.orderNumber ?? null, wpId: d.wpId,
      productId, qty: d.qty, direction,
    };
    try {
      await prisma.$transaction(async (tx) => {
        // Reserve the token first: if the movement then fails, the whole
        // transaction rolls back and the next poll retries cleanly.
        const row = await tx.wpStockIngest.create({
          data: { ...base, status: productId ? status : 'UNMATCHED' },
          select: { id: true },
        });
        if (!live || !productId) return;
        const r = await applyIngestMovement(tx, { productId, qty: d.qty, direction, wpOrderId: o.wpOrderId, wpId: d.wpId });
        await tx.wpStockIngest.update({ where: { id: row.id }, data: { appliedAt: new Date(), shortfall: r.shortfall } });
        res.moved += r.moved;
        res.shortfall += r.shortfall;
      });
      res.recorded++;
    } catch (e) {
      if (isDuplicate(e)) { res.duplicates++; continue; } // already ingested — the point of the constraint
      throw e;
    }
  }
  if (!live && mode === 'apply') res.skipped = 'pre_cutover';
  return res;
}

/** Prisma's unique-constraint violation — here it means "seen already", not an error. */
function isDuplicate(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002';
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
