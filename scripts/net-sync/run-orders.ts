import 'dotenv/config';
import { prisma } from '@/lib/prisma';
import { createSourcePool } from '@/lib/net-sync/wp-source';
import { importOrders } from '@/lib/net-sync/orders';

/**
 * veeey.net order-history import — WP orders as read-only records (sync #2).
 * No loyalty/notifications/stock effects; existing legacyWpId rows skipped.
 *
 *   npx tsx scripts/net-sync/run-orders.ts            # DRY RUN — counts only
 *   npx tsx scripts/net-sync/run-orders.ts --commit
 */
async function main() {
  const commit = process.argv.includes('--commit');
  console.log(`\n=== veeey.net order-history import — ${commit ? 'COMMIT' : 'DRY RUN (no writes)'} ===`);
  const pool = await createSourcePool();
  try {
    const r = await importOrders(pool, { dryRun: !commit, onProgress: (n, t) => process.stdout.write(`\r  orders ${n}/${t}…   `) });
    console.log('\n\n=== order-history summary (counts only) ===');
    for (const [k, v] of [
      ['Source WP orders', r.source],
      ['Created', r.created],
      ['Skipped (already imported)', r.skippedExisting],
      ['— linked to a customer', r.linkedCustomers],
      ['— guest orders', r.guests],
      ['Items created', r.itemsCreated],
      ['Items unmatched (product gone)', r.itemsUnmatched],
      ['Errors', r.errors.length],
    ] as [string, unknown][]) console.log(`  ${String(k).padEnd(32)} ${v}`);
    console.log('  By status: ' + Object.entries(r.byStatus).map(([k, v]) => `${k}=${v}`).join(', '));
    if (r.errors.length) for (const e of r.errors.slice(0, 8)) console.log(`    wp#${e.wpId}: ${e.detail}`);
    console.log(`\n${commit ? '✅ Order history imported.' : 'ℹ️  DRY RUN — nothing written. Re-run with --commit.'}\n`);
  } finally {
    await pool.end();
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
