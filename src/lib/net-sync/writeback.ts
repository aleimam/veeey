/**
 * net-sync Phase 3 — WP stock writeback service (enqueue + drain).
 *
 * Enqueue runs inside the veeey.net app on order status transitions
 * (order-service → transitionOrder); the drain runs on the box every 2 min
 * (scripts/net-sync/run-writeback.ts via sync-cron.sh --writeback).
 *
 * GATING — `NET_SYNC_WRITEBACK` env:
 *   absent → everything no-ops (veeey.com stays completely inert)
 *   'dry'  → enqueue records deltas; drain LOGS what it would apply, writes nothing
 *   'on'   → drain applies deltas to WP via wc_update_product_stock (probe-verified:
 *            updates _stock + wc_product_meta_lookup + stock status atomically)
 *
 * Exactly-once: the (orderId, wpId, direction) unique key makes enqueue
 * idempotent; the drain stamps APPLIED per row. Cancelling an order whose SALE
 * rows are still PENDING just SKIPs them (WP was never touched → nothing to
 * restore); only APPLIED sales get RESTORE rows.
 */
import { prisma } from '@/lib/prisma';
import { writebackAction, linesToDeltas } from './writeback-logic';

export const writebackMode = (): 'off' | 'dry' | 'on' => {
  const v = (process.env.NET_SYNC_WRITEBACK ?? '').toLowerCase();
  return v === 'on' ? 'on' : v === 'dry' ? 'dry' : 'off';
};

/** Called (best-effort) after every order status transition. */
export async function enqueueWriteback(orderId: string, from: string, to: string): Promise<void> {
  if (writebackMode() === 'off') return;
  const action = writebackAction(from, to);
  if (!action) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { number: true, items: { select: { qty: true, product: { select: { legacyWpId: true } } } } },
  });
  if (!order) return;
  const deltas = linesToDeltas(order.items.map((i) => ({ wpId: i.product.legacyWpId, qty: i.qty })));
  if (!deltas.length) return;

  if (action === 'SALE') {
    await prisma.netStockOutbox.createMany({
      data: deltas.map((d) => ({ orderId, orderNumber: order.number, wpId: d.wpId, qty: d.qty, direction: 'SALE' })),
      skipDuplicates: true, // re-confirming after an un-cancel can't double-sell
    });
    return;
  }

  // RESTORE: only un-do sales that actually reached WP.
  const sales = await prisma.netStockOutbox.findMany({ where: { orderId, direction: 'SALE' } });
  const restores: { wpId: number; qty: number }[] = [];
  for (const s of sales) {
    if (s.status === 'PENDING') {
      // Never hit WP — retract it instead of round-tripping a -q then +q.
      await prisma.netStockOutbox.update({ where: { id: s.id }, data: { status: 'SKIPPED' } });
    } else if (s.status === 'APPLIED') {
      restores.push({ wpId: s.wpId, qty: s.qty });
    }
  }
  if (restores.length) {
    await prisma.netStockOutbox.createMany({
      data: restores.map((d) => ({ orderId, orderNumber: order.number, wpId: d.wpId, qty: d.qty, direction: 'RESTORE' })),
      skipDuplicates: true,
    });
  }
}

export type WritebackApplier = (wpId: number, qty: number, op: 'decrease' | 'increase') => Promise<number>;

export type DrainSummary = { pending: number; applied: number; failed: number; dry: boolean };

const MAX_ATTEMPTS = 5;

/** Apply all PENDING rows to WP (oldest first), exactly once each. */
export async function drainWriteback(apply: WritebackApplier, opts: { dryRun: boolean }): Promise<DrainSummary> {
  const rows = await prisma.netStockOutbox.findMany({
    where: { status: 'PENDING', attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });
  const s: DrainSummary = { pending: rows.length, applied: 0, failed: 0, dry: opts.dryRun };
  for (const r of rows) {
    const op = r.direction === 'SALE' ? 'decrease' : 'increase';
    if (opts.dryRun) {
      console.log(`  [dry] would ${op} wp#${r.wpId} by ${r.qty} (order ${r.orderNumber ?? r.orderId})`);
      continue;
    }
    try {
      const newStock = await apply(r.wpId, r.qty, op);
      await prisma.netStockOutbox.update({
        where: { id: r.id },
        data: { status: 'APPLIED', appliedAt: new Date(), stockAfter: Number.isFinite(newStock) ? newStock : null },
      });
      s.applied++;
      console.log(`  ${op} wp#${r.wpId} by ${r.qty} → stock ${newStock} (order ${r.orderNumber ?? r.orderId})`);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      const attempts = r.attempts + 1;
      await prisma.netStockOutbox.update({
        where: { id: r.id },
        data: { attempts, lastError: detail.slice(0, 500), ...(attempts >= MAX_ATTEMPTS ? { status: 'FAILED' } : {}) },
      });
      s.failed++;
      console.error(`  FAILED ${op} wp#${r.wpId} by ${r.qty}: ${detail}`);
    }
  }
  return s;
}
