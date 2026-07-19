import 'dotenv/config';
import { prisma } from '@/lib/prisma';
import { createSourcePool } from '@/lib/net-sync/wp-source';
import { enrichCatalog } from '@/lib/net-sync/taxonomy-enrich';

/**
 * veeey.net taxonomy enrichment — product tags + attributes from WP (sync #1).
 *
 *   npx tsx scripts/net-sync/run-enrich.ts            # DRY RUN — counts only
 *   npx tsx scripts/net-sync/run-enrich.ts --commit   # write tags/attributes/links
 *
 * Env: NET_SYNC_MYSQL_URL (required), NET_SYNC_WP_PREFIX (default SFPgx_).
 */
async function main() {
  const commit = process.argv.includes('--commit');
  console.log(`\n=== veeey.net taxonomy enrichment — ${commit ? 'COMMIT' : 'DRY RUN (no writes)'} ===`);
  const pool = await createSourcePool();
  try {
    const r = await enrichCatalog(pool, { dryRun: !commit, onProgress: (n, t) => process.stdout.write(`\r  products ${n}/${t}…   `) });
    console.log('\n\n=== enrichment summary ===');
    for (const [k, v] of [
      ['Products touched', r.productsTouched],
      ['Tags created', r.tagsCreated],
      ['Tag links set', r.tagLinks],
      ['Attributes created', r.attributesCreated],
      ['Attribute values created', r.valuesCreated],
      ['Attribute links set', r.attrLinks],
      ['Errors', r.errors.length],
    ] as [string, unknown][]) console.log(`  ${String(k).padEnd(28)} ${v}`);
    if (r.errors.length) for (const e of r.errors.slice(0, 10)) console.log(`    wp#${e.wpId}: ${e.detail}`);
    console.log(`\n${commit ? '✅ Enrichment applied.' : 'ℹ️  DRY RUN — nothing written. Re-run with --commit.'}\n`);
  } finally {
    await pool.end();
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
