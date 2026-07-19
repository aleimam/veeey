import 'dotenv/config';
import { prisma } from '@/lib/prisma';
import { createSourcePool } from '@/lib/net-sync/wp-source';
import { importCustomers } from '@/lib/net-sync/customers';

/**
 * veeey.net customer sync — ongoing one-way pull of registered egyptvitamins.net
 * customers (name/email/phone/addresses + lifetime-spend snapshot → tier). NO
 * passwords (OTP login). PII-safe: prints COUNTS only, never customer data.
 *
 *   npx tsx scripts/net-sync/run-customers.ts            # DRY RUN — counts only
 *   npx tsx scripts/net-sync/run-customers.ts --commit   # write to veeey.net Postgres
 *
 * Env: NET_SYNC_MYSQL_URL (required), NET_SYNC_WP_PREFIX (default SFPgx_).
 */
async function main() {
  const commit = process.argv.includes('--commit');
  console.log(`\n=== veeey.net customer sync — ${commit ? 'COMMIT' : 'DRY RUN (no writes)'} ===`);
  const pool = await createSourcePool();
  try {
    const r = await importCustomers(pool, { dryRun: !commit, onProgress: (n, t) => process.stdout.write(`\r  processed ${n}/${t}…   `) });
    console.log('\n\n=== customer summary (counts only — no PII) ===');
    for (const [k, v] of [
      ['Source registered customers', r.source],
      ['Created (new)', r.created],
      ['Linked (existing email)', r.linked],
      ['Updated (changed)', r.updated],
      ['Skipped (unchanged)', r.skipped],
      ['Addresses created', r.addressesCreated],
      ['— with a phone', r.withPhone],
      ['— with lifetime spend > 0', r.withSpend],
      ['Errors', r.errors.length],
    ] as [string, unknown][]) console.log(`  ${String(k).padEnd(32)} ${v}`);
    if (r.errors.length) for (const e of r.errors.slice(0, 10)) console.log(`    wp_user#${e.wpUserId}: ${e.detail}`);
    console.log(`\n${commit ? '✅ Customers synced.' : 'ℹ️  DRY RUN — nothing written. Re-run with --commit.'}\n`);
  } finally {
    await pool.end();
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
