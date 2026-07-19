import 'dotenv/config';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { prisma } from '@/lib/prisma';
import { drainWriteback, writebackMode } from '@/lib/net-sync/writeback';

const execFileP = promisify(execFile);

/**
 * veeey.net → WP stock-writeback drain (Phase 3). Cron every 2 min on the box.
 *
 * Mode comes from NET_SYNC_WRITEBACK in /opt/veeey/.env:
 *   absent → exits silently (veeey.com / disabled)
 *   dry    → logs would-apply lines, writes nothing, rows stay PENDING
 *   on     → applies deltas via wp-cli wc_update_product_stock, stamps APPLIED
 *
 * Silent when there is nothing to do, so the 2-min cron doesn't fill the log.
 */
const WP_PATH = process.env.NET_SYNC_WP_PATH || '/home/egyptvitamins.net/public_html';
const WP_OSUSER = process.env.NET_SYNC_WP_OSUSER || 'egypt1907';
const PHP_BIN = process.env.NET_SYNC_PHP || '/usr/local/lsws/lsphp82/bin/php';
const WP_CLI = process.env.NET_SYNC_WP_CLI || '/usr/local/bin/wp';

/** Apply one delta through WooCommerce's own stock function (probe-verified). */
async function applyViaWpCli(wpId: number, qty: number, op: 'decrease' | 'increase'): Promise<number> {
  // Integer-interpolated only (wpId/qty validated ints; op from our own enum).
  const code =
    `$r = wc_update_product_stock(${Math.trunc(wpId)}, ${Math.trunc(qty)}, '${op}');` +
    ` if ($r === false || $r === null) { fwrite(STDERR, 'wc_update_product_stock returned '.var_export($r, true)); exit(1); }` +
    ` echo (int) $r;`;
  const { stdout } = await execFileP('sudo', ['-u', WP_OSUSER, PHP_BIN, WP_CLI, `--path=${WP_PATH}`, 'eval', code], { timeout: 60_000 });
  const n = Number(stdout.trim());
  if (!Number.isFinite(n)) throw new Error(`unparseable wp-cli output: ${stdout.slice(0, 120)}`);
  return n;
}

async function main() {
  const mode = writebackMode();
  if (mode === 'off') return; // silent — disabled or wrong box
  const pendingCount = await prisma.netStockOutbox.count({ where: { status: 'PENDING' } });
  if (pendingCount === 0) return; // silent — nothing to do

  console.log(`----- ${new Date().toISOString()} writeback drain (${mode}) — ${pendingCount} pending -----`);
  const s = await drainWriteback(applyViaWpCli, { dryRun: mode !== 'on' });
  console.log(`----- drained: ${s.applied} applied, ${s.failed} failed${s.dry ? ' (DRY — nothing written)' : ''} -----`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
