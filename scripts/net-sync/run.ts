import 'dotenv/config'; // tsx doesn't auto-load .env — load it for the standalone run
import { prisma } from '@/lib/prisma';
import { createSourcePool, readCatalog } from '@/lib/net-sync/wp-source';
import { importCatalog, archiveVanished, currentStockMaster } from '@/lib/net-sync/importer';

/**
 * veeey.net catalog import / dry-run CLI (Phase 1).
 *
 *   npx tsx scripts/net-sync/run.ts            # DRY RUN (default) — writes nothing
 *   npx tsx scripts/net-sync/run.ts --commit   # actually write the Veeey Postgres
 *   npx tsx scripts/net-sync/run.ts --limit 50 # only the first 50 products (testing)
 *
 * Requires NET_SYNC_MYSQL_URL (mysql://…/egyptvit_website) — refuses to run without it,
 * so it can never touch veeey.com. Reads the WP MariaDB read-only; only --commit
 * writes veeey.net's Postgres.
 */
async function main() {
  const args = process.argv.slice(2);
  const commit = args.includes('--commit');
  const limArg = args.indexOf('--limit');
  const limit = limArg >= 0 ? Number(args[limArg + 1]) : undefined;

  console.log(`\n=== veeey.net catalog sync — ${commit ? 'COMMIT (writing Postgres)' : 'DRY RUN (no writes)'} ===`);
  const master = currentStockMaster();
  console.log(master === 'net'
    ? '  stock master: VEEEY.NET — catalog only; lot quantities are NOT touched by this sync'
    : '  stock master: WP — lot quantities are overwritten from the source');
  const pool = await createSourcePool();
  try {
    console.log('Reading source catalog (egyptvitamins.net WP/ATUM/WPML)…');
    let raws = await readCatalog(pool);
    if (limit && Number.isFinite(limit)) raws = raws.slice(0, limit);
    console.log(`Source products read: ${raws.length}`);

    const s = await importCatalog(raws, {
      dryRun: !commit,
      onProgress: (n, total) => process.stdout.write(`\r  processed ${n}/${total}…   `),
    });
    console.log('\n');

    const rows: [string, unknown][] = [
      ['Products seen', s.productsSeen],
      ['  → created', s.productsCreated],
      ['  → updated', s.productsUpdated],
      ['Lots created', s.lotsCreated],
      ['Lots updated', s.lotsUpdated],
      ['Lots zeroed (gone from source)', s.lotsZeroed],
      ['  live lots', s.liveLots],
      ['  expired lots (kept for history)', s.expiredLots],
      ['  non-perishable lots (null expiry)', s.nonPerishableLots],
      ['Total live units in stock', s.totalLiveUnits],
      ['Brands created', s.brandsCreated],
      ['Categories created', s.categoriesCreated],
      ['Products with no price', s.noPrice],
      ['Products with no live stock', s.noLiveStock],
      ['Products with synthetic lot (no ATUM)', s.syntheticLots],
      ['Errors', s.errors.length],
    ];
    console.log('=== reconciliation summary ===');
    for (const [k, v] of rows) console.log(`  ${k.padEnd(38)} ${v}`);

    // Delete-detection (Phase 2): only on a FULL scan (a --limit run's partial set
    // would look like a mass deletion). archiveVanished has its own safety floor.
    if (!limit) {
      const arch = await archiveVanished(raws.map((r) => r.wpId), { dryRun: !commit });
      if (arch.skippedForSafety) {
        console.log(`  ${'Vanished → archive'.padEnd(38)} SKIPPED (safety floor: scan too small, ${arch.candidates} would archive)`);
      } else {
        console.log(`  ${'Vanished from source → archived'.padEnd(38)} ${arch.archived}`);
      }
    } else {
      console.log(`  ${'Vanished → archive'.padEnd(38)} skipped (--limit run)`);
    }

    if (s.errors.length) {
      console.log('\n  first errors:');
      for (const e of s.errors.slice(0, 10)) console.log(`    wp#${e.wpId}: ${e.detail}`);
    }
    console.log(`\n${commit ? '✅ COMMITTED to veeey.net Postgres.' : 'ℹ️  DRY RUN — nothing written. Re-run with --commit to apply.'}\n`);
  } finally {
    await pool.end();
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
