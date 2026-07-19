import 'dotenv/config';
import { prisma } from '@/lib/prisma';
import { createSourcePool } from '@/lib/net-sync/wp-source';
import { importReviews } from '@/lib/net-sync/reviews';

/**
 * veeey.net review import — approved WP product reviews (sync #3).
 *
 *   npx tsx scripts/net-sync/run-reviews.ts            # DRY RUN
 *   npx tsx scripts/net-sync/run-reviews.ts --commit   # write reviews + recompute ratings
 */
async function main() {
  const commit = process.argv.includes('--commit');
  console.log(`\n=== veeey.net review import — ${commit ? 'COMMIT' : 'DRY RUN (no writes)'} ===`);
  const pool = await createSourcePool();
  try {
    const r = await importReviews(pool, { dryRun: !commit });
    for (const [k, v] of [
      ['Source rated approved reviews', r.source],
      ['Created', r.created],
      ['Skipped (already imported)', r.skippedExisting],
      ['Skipped (product not imported)', r.skippedNoProduct],
      ['Products rating-recomputed', r.productsRecomputed],
      ['Errors', r.errors],
    ] as [string, unknown][]) console.log(`  ${String(k).padEnd(32)} ${v}`);
    console.log(`\n${commit ? '✅ Reviews imported.' : 'ℹ️  DRY RUN — nothing written. Re-run with --commit.'}\n`);
  } finally {
    await pool.end();
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
