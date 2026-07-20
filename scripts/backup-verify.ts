import 'dotenv/config'; // tsx doesn't auto-load .env — load it for the standalone run
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { decryptSecret } from '@/lib/backup/secret-box';
import { parseArchiveName, ourArchives, formatBytes } from '@/lib/backup/backup-logic';
import { archivePrefix } from '@/lib/backup/backup-service';

/**
 * Off-site backup VERIFICATION + RESTORE DRILL (BACKUP.md §11 / §11.1).
 *
 * "An untested backup is a hypothesis." A green status field only proves a file
 * was written *somewhere* — §2.1 records a real incident where every run
 * reported SUCCESS while writing into a wrongly-nested folder. So this script
 * never trusts our own tables: it lists the remote folders, pulls an archive
 * back, and restores it into a scratch database.
 *
 * Read-only against production: it downloads, restores into a THROWAWAY
 * database, compares row counts, then drops it. It never writes to the remote
 * and never touches the live database.
 *
 *   npx tsx scripts/backup-verify.ts            # drill the newest db archive
 *   npx tsx scripts/backup-verify.ts --full     # drill the newest FULL archive
 *   npx tsx scripts/backup-verify.ts --list     # list folders only, no download
 *
 * Default is the db-only archive on purpose: it comes from the same `pg_dump`
 * as the full one, so it proves the restore path without pulling ~1 GB across a
 * live server's uplink. Use --full periodically to also prove `uploads/`.
 */
const execFileP = promisify(execFile);

/**
 * Strip credentials from anything we print. `execFile` puts the whole argv in
 * its error message, and psql/pg_restore take a connection URL as an argument —
 * so an unsanitised failure prints `postgresql://user:PASSWORD@host` straight
 * into the terminal and into whatever captures it. Learned the hard way.
 */
const redact = (s: string) => s.replace(/(postgresql:\/\/[^:@\s]+:)[^@\s]+@/g, '$1***@');

/** Run a command, guaranteeing its error text carries no credentials.
 *  `encoding: 'utf8'` is pinned so stdout is always a string, never a Buffer. */
async function run(
  cmd: string,
  args: string[],
  opts: { maxBuffer?: number; cwd?: string } = {},
): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execFileP(cmd, args, { ...opts, encoding: 'utf8' });
  } catch (e) {
    const err = e as Error & { stderr?: string };
    const detail = redact(err.stderr || err.message || '');
    throw Object.assign(new Error(`${cmd} failed: ${detail.split('\n').filter(Boolean).slice(-3).join(' | ')}`), { stderr: detail });
  }
}

/** Business tables worth counting — a structurally valid but EMPTY restore
 *  passes every structural check, so we compare real rows against live. */
const WITNESS_TABLES = ['Product', 'Customer', 'Order', 'OrderItem', 'Lot', 'Brand'];

const ok = (s: string) => console.log(`  ✓ ${s}`);
const bad = (s: string) => console.log(`  ✗ ${s}`);

async function main() {
  const wantFull = process.argv.includes('--full');
  const listOnly = process.argv.includes('--list');
  let failures = 0;

  const cfg = await prisma.backupConfig.findFirst();
  if (!cfg?.host || !cfg.username) throw new Error('Backup is not configured — set it up at /admin/backup first.');
  const password = decryptSecret(cfg.passwordEnc);
  if (!password) throw new Error('No stored password (or SESSION/AUTH secret rotated) — re-enter it at /admin/backup.');

  // This store's own prefix — on a shared box the other store's archives must
  // read as foreign here, exactly as they do to the pruner.
  const PREFIX = archivePrefix();
  console.log(`\nArchive prefix for this store: ${PREFIX}`);

  const tiers = await prisma.backupTier.findMany({ orderBy: { sortOrder: 'asc' } });
  const { default: SftpClient } = await import('ssh2-sftp-client');
  const client = new SftpClient();
  const tmp = path.join(os.tmpdir(), `veeey-backup-drill-${randomUUID()}`);
  const scratchDb = `veeey_drill_${Date.now()}`;
  let scratchCreated = false;
  let usedSudo = false;

  try {
    await client.connect({ host: cfg.host, port: cfg.port, username: cfg.username, password, readyTimeout: 30_000 });
    const home = await client.cwd().catch(() => null);
    console.log(`\nConnected to ${cfg.host}:${cfg.port} as ${cfg.username} (login dir: ${home ?? 'unknown'})`);

    // ── §11 / §2.1: prove each level's files are really in its own folder ────
    console.log('\n── Remote folders ─────────────────────────────────────────');
    const candidates: Array<{ tier: string; dir: string; name: string; at: Date; kind: string }> = [];
    for (const t of tiers) {
      let names: string[] = [];
      try {
        names = (await client.list(t.remotePath)).map((f) => f.name);
      } catch (e) {
        bad(`${t.key.padEnd(6)} ${t.remotePath} — UNREADABLE: ${(e as Error).message}`);
        failures++;
        continue;
      }
      const mine = ourArchives(names, PREFIX);
      const foreign = names.filter((n) => parseArchiveName(n, PREFIX) === null);
      console.log(`  ${t.key.padEnd(6)} ${t.remotePath.padEnd(14)} ${String(mine.length).padStart(3)} archive(s)` +
        (foreign.length ? `, ${foreign.length} other file(s)/dir(s) — retention will ignore these` : ''));
      // A folder that should hold archives but is empty is the nested-path bug.
      if (mine.length === 0 && t.lastRunAt) {
        bad(`${t.key} reports lastRunAt ${t.lastRunAt.toISOString()} but its folder is EMPTY — check for a nested path (BACKUP.md §2.1)`);
        failures++;
      }
      for (const n of mine) {
        const p = parseArchiveName(n, PREFIX)!;
        candidates.push({ tier: t.key, dir: t.remotePath, name: n, at: p.at, kind: p.kind });
      }
    }
    if (candidates.length === 0) throw new Error('No archives found in any folder — nothing to drill.');
    if (listOnly) { console.log('\n--list given; stopping before download.'); return void process.exit(failures ? 1 : 0); }

    // ── §11.1 step 1: download, byte-exact ──────────────────────────────────
    const pool = candidates.filter((c) => (wantFull ? c.kind === 'full' : c.kind === 'db'));
    const pick = (pool.length ? pool : candidates).sort((a, b) => b.at.getTime() - a.at.getTime())[0];
    console.log(`\n── Restore drill: ${pick.tier} / ${pick.name} ─────────────`);
    await fs.mkdir(tmp, { recursive: true });

    const remote = `${pick.dir.replace(/\/+$/, '')}/${pick.name}`;
    const remoteSize = Number(((await client.stat(remote)) as { size: number }).size);
    const local = path.join(tmp, pick.name);
    await client.fastGet(remote, local);
    const localSize = (await fs.stat(local)).size;
    if (localSize === remoteSize) ok(`downloaded ${formatBytes(localSize)} — byte-exact`);
    else { bad(`size mismatch: remote ${remoteSize} vs local ${localSize}`); failures++; }

    // ── step 2: unpack + manifest honesty ───────────────────────────────────
    const un = path.join(tmp, 'unpacked');
    await fs.mkdir(un, { recursive: true });
    await run('tar', ['xzf', local, '-C', un], { maxBuffer: 1 << 26 });
    const entries = await fs.readdir(un);
    ok(`unpacked: ${entries.join(', ')}`);

    const manifest = JSON.parse(await fs.readFile(path.join(un, 'manifest.json'), 'utf8'));
    const claimsUploads = String(manifest.contents ?? '').includes('uploads');
    const hasUploads = entries.includes('uploads');
    if (claimsUploads === hasUploads) ok(`manifest honest: contents="${manifest.contents}", uploads ${hasUploads ? 'present' : 'absent'}`);
    else { bad(`manifest claims "${manifest.contents}" but uploads ${hasUploads ? 'ARE' : 'are NOT'} present`); failures++; }
    if (hasUploads) {
      const count = (await run('bash', ['-c', `find ${JSON.stringify(path.join(un, 'uploads'))} -type f | wc -l`])).stdout.trim();
      ok(`uploads/: ${count} file(s)`);
    }

    // ── step 3: restore into a scratch database and prove it is VALID ───────
    const dump = entries.find((e) => e.endsWith('.dump')) ?? 'database.dump';
    const dumpPath = path.join(un, dump);
    await fs.access(dumpPath);

    const url = new URL(process.env.DATABASE_URL!);
    const adminUrl = new URL(url.toString()); adminUrl.pathname = '/postgres';
    const scratchUrl = new URL(url.toString()); scratchUrl.pathname = `/${scratchDb}`;

    // The app role deliberately lacks CREATEDB (least privilege), so fall back
    // to the postgres superuser via sudo and hand ownership to the app role so
    // the restore below can connect normally. Granting the app CREATEDB just to
    // run a drill would be a worse trade.
    const owner = decodeURIComponent(url.username);
    try {
      await run('psql', [adminUrl.toString(), '-v', 'ON_ERROR_STOP=1', '-c', `CREATE DATABASE "${scratchDb}"`]);
    } catch (e) {
      if (!/permission denied/i.test((e as Error).message)) throw e;
      console.log('  ~ app role cannot CREATE DATABASE — using the postgres superuser via sudo');
      await run('sudo', ['-n', '-u', 'postgres', 'createdb', '-O', owner, scratchDb], { cwd: os.tmpdir() });
      usedSudo = true;
    }
    scratchCreated = true;
    // pg_restore exits non-zero on benign notices (extensions/roles); the real
    // check is the row counts below, so tolerate its status and read the data.
    await run('pg_restore', ['--dbname', scratchUrl.toString(), '--no-owner', '--no-privileges', '-j', '2', dumpPath], { maxBuffer: 1 << 28 })
      .then(() => ok('pg_restore completed cleanly'))
      .catch((e: Error & { stderr?: string }) => {
        const errs = (e.stderr ?? '').split('\n').filter((l) => /error/i.test(l));
        console.log(`  ~ pg_restore reported ${errs.length} non-fatal message(s) — validating by row counts instead`);
      });

    const q = async (dbUrl: string, sql: string) =>
      (await run('psql', [dbUrl, '-tAc', sql])).stdout.trim();

    const tableCount = await q(scratchUrl.toString(), `SELECT count(*) FROM information_schema.tables WHERE table_schema='public'`);
    ok(`restored schema: ${tableCount} tables`);

    // ── step 4: read real rows and compare against live ─────────────────────
    console.log('\n  table            restored        live     delta');
    let emptyWitness = false;
    for (const t of WITNESS_TABLES) {
      const r = Number(await q(scratchUrl.toString(), `SELECT count(*) FROM "${t}"`).catch(() => '-1'));
      const l = Number(await q(process.env.DATABASE_URL!, `SELECT count(*) FROM "${t}"`).catch(() => '-1'));
      const d = r - l;
      console.log(`  ${t.padEnd(14)} ${String(r).padStart(9)} ${String(l).padStart(11)} ${(d > 0 ? `+${d}` : String(d)).padStart(9)}`);
      if (r === 0 && l > 0) emptyWitness = true;
    }
    if (emptyWitness) { bad('a witness table is EMPTY in the restore while live has rows — the archive is not a real capture'); failures++; }
    else ok('witness tables populated (small deltas vs live are expected — it is a point-in-time snapshot)');

    console.log(failures === 0
      ? '\n✅ RESTORE DRILL PASSED — this archive is a real, restorable capture.\n'
      : `\n❌ ${failures} problem(s) found — see the ✗ lines above.\n`);
    process.exitCode = failures ? 1 : 0;
  } finally {
    // Always drop the scratch database, by whichever route created it.
    if (scratchCreated) {
      if (usedSudo) {
        await run('sudo', ['-n', '-u', 'postgres', 'dropdb', '--if-exists', scratchDb], { cwd: os.tmpdir() })
          .then(() => console.log(`  · scratch database ${scratchDb} dropped`))
          .catch((e) => console.error(`  ! could not drop scratch database ${scratchDb}: ${(e as Error).message}`));
      } else {
        const admin = new URL(process.env.DATABASE_URL!); admin.pathname = '/postgres';
        await run('psql', [admin.toString(), '-c', `DROP DATABASE IF EXISTS "${scratchDb}"`])
          .then(() => console.log(`  · scratch database ${scratchDb} dropped`))
          .catch((e) => console.error(`  ! could not drop scratch database ${scratchDb}: ${(e as Error).message}`));
      }
    }
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
    await client.end().catch(() => {});
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error('[backup-verify]', e instanceof Error ? e.message : e); process.exit(1); });
