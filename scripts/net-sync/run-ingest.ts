import 'dotenv/config';
import { prisma } from '@/lib/prisma';
import { createSourcePool } from '@/lib/net-sync/wp-source';
import { readOrders } from '@/lib/net-sync/orders';
import { ingestWpOrder, ingestMode, ingestReconcile, unmatchedIngestCount } from '@/lib/net-sync/ingest';

/**
 * Stage 2 — the POLLING SAFETY NET for ev.net sale ingestion.
 *
 * The webhook is the fast path (seconds); this is the backstop that catches
 * anything it dropped — a failed delivery, a restart, a WP plugin that didn't
 * fire. Both write through the same idempotent path, so overlap is free and the
 * window is deliberately generous.
 *
 *   npx tsx scripts/net-sync/run-ingest.ts                # last 6h
 *   npx tsx scripts/net-sync/run-ingest.ts --hours 48
 *   npx tsx scripts/net-sync/run-ingest.ts --reconcile    # the shadow-run diff
 *
 * Honours WP_INGEST_MODE (off | shadow | apply). In `off` it does nothing, so
 * this is inert on veeey.com, which has no WP peer.
 */
function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const n = Number(process.argv[i + 1]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function reconcile() {
  const hours = arg('hours', 24);
  const r = await ingestReconcile(hours);
  const unmatched = await unmatchedIngestCount();
  console.log(`\n=== ev.net ingest reconciliation — last ${hours}h (since ${r.since.toISOString()}) ===`);
  console.log(`  movements recorded: ${r.totalRows}`);
  console.log(`  products touched:   ${r.products.length}`);
  console.log(`  unmatched (all time): ${unmatched}${unmatched ? '  ⚠️ these are real goods we cannot attribute' : ''}`);
  if (r.products.length) {
    console.log('\n  wpId      net units   rows   product');
    for (const p of r.products.slice(0, 40)) {
      console.log(`  ${String(p.wpId).padEnd(9)} ${String(p.netUnits).padStart(9)} ${String(p.rows).padStart(6)}   ${p.productId ?? '— unmatched —'}`);
    }
    if (r.products.length > 40) console.log(`  …and ${r.products.length - 40} more`);
  }
  console.log('\n  Compare these against WP\'s own stock movement for the same window.');
  console.log('  A consistently near-zero difference is the go/no-go gate for the flip.\n');
}

async function main() {
  const mode = ingestMode();
  if (process.argv.includes('--reconcile')) {
    await reconcile();
    await prisma.$disconnect();
    return;
  }

  const hours = arg('hours', 6);
  console.log(`\n=== ev.net sale ingest — mode=${mode}, window=${hours}h ===`);
  if (mode === 'off') {
    console.log('  WP_INGEST_MODE=off — nothing to do.\n');
    await prisma.$disconnect();
    return;
  }

  const pool = await createSourcePool();
  try {
    const since = new Date(Date.now() - hours * 3_600_000);
    const orders = await readOrders(pool, { updatedSince: since });
    let recorded = 0;
    let moved = 0;
    const skips = new Map<string, number>();
    for (const o of orders) {
      const r = await ingestWpOrder({
        wpOrderId: o.wpId,
        orderNumber: String(o.wpId),
        status: o.status,
        lines: o.items.map((i) => ({ wpId: i.productWpId, qty: i.qty })),
      });
      recorded += r.recorded;
      if (r.direction) moved += 1;
      if (r.skipped) skips.set(r.skipped, (skips.get(r.skipped) ?? 0) + 1);
    }
    console.log(`  WP orders in window:  ${orders.length}`);
    console.log(`  with a stock effect:  ${moved}`);
    console.log(`  movements recorded:   ${recorded}  (duplicates are skipped silently — the webhook usually got there first)`);
    if (skips.size) console.log('  skipped: ' + [...skips].map(([k, v]) => `${k}=${v}`).join(', '));
    console.log(mode === 'shadow' ? '\n  SHADOW — nothing applied to stock.\n' : '\n  APPLY — movements are live.\n');
  } finally {
    await pool.end();
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
