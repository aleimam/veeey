import 'dotenv/config';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { createSourcePool } from '@/lib/net-sync/wp-source';
import { syncImages } from '@/lib/net-sync/images';

/**
 * veeey.net product-image copy (Phase 1b).
 *
 *   npx tsx scripts/net-sync/run-images.ts            # DRY RUN — counts only, no copy/DB write
 *   npx tsx scripts/net-sync/run-images.ts --commit   # copy files + write ProductImage rows
 *
 * Env:
 *   NET_SYNC_MYSQL_URL     source WP MariaDB (required)
 *   NET_SYNC_WP_PREFIX     table prefix (default SFPgx_)
 *   NET_SYNC_UPLOADS_SRC   WP uploads dir (default /home/egyptvitamins.net/public_html/wp-content/uploads)
 *   NET_SYNC_UPLOADS_DEST  veeey.net dest dir (default <cwd>/public/uploads/net) → served at /uploads/net/*
 */
async function main() {
  const commit = process.argv.includes('--commit');
  const srcDir = process.env.NET_SYNC_UPLOADS_SRC || '/home/egyptvitamins.net/public_html/wp-content/uploads';
  const destDir = process.env.NET_SYNC_UPLOADS_DEST || path.join(process.cwd(), 'public', 'uploads', 'net');

  console.log(`\n=== veeey.net image copy — ${commit ? 'COMMIT (copying + writing rows)' : 'DRY RUN (no copy/write)'} ===`);
  console.log(`  src:  ${srcDir}`);
  console.log(`  dest: ${destDir}  (url /uploads/net/*)`);
  const pool = await createSourcePool();
  try {
    const s = await syncImages(pool, {
      srcDir, destDir, dryRun: !commit,
      onProgress: (n, total) => process.stdout.write(`\r  processed ${n}/${total}…   `),
    });
    console.log('\n\n=== image summary ===');
    for (const [k, v] of [
      ['Products seen', s.productsSeen],
      ['Products with ≥1 image', s.productsWithImages],
      ['Files copied', s.filesCopied],
      ['Files missing on disk', s.filesMissing],
      ['ProductImage rows written', s.imageRowsWritten],
      ['Errors', s.errors.length],
    ] as [string, unknown][]) console.log(`  ${String(k).padEnd(30)} ${v}`);
    if (s.errors.length) for (const e of s.errors.slice(0, 10)) console.log(`    wp#${e.wpId}: ${e.detail}`);
    console.log(`\n${commit ? '✅ Images copied + ProductImage rows written.' : 'ℹ️  DRY RUN — nothing copied. Re-run with --commit.'}\n`);
  } finally {
    await pool.end();
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
