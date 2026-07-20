import 'server-only';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { encryptSecret, decryptSecret } from './secret-box';
import {
  isBackupDue,
  backupFileName,
  prunableArchives,
  contentsList,
  contentsToKind,
  explainPathError,
  isBackupFrequency,
  isBackupProtocol,
  isTierContents,
  clampHour,
  clampWeekday,
  clampDayOfMonth,
  clampPort,
  clampKeep,
  clampEveryN,
  type BackupFrequency,
  type ArchiveKind,
} from './backup-logic';

const execFileP = promisify(execFile);
const KEY = 'BACKUP';

/** The single config row, created (disabled) on first access. */
async function getRow() {
  const r = await prisma.backupConfig.findUnique({ where: { singleton: KEY } });
  return r ?? prisma.backupConfig.create({ data: { singleton: KEY } });
}

export type TierRow = Awaited<ReturnType<typeof prisma.backupTier.findFirstOrThrow>>;
export type ConfigRow = Awaited<ReturnType<typeof getRow>>;

/** The level that operator-triggered ("Back up now") runs write to. */
export const MANUAL_TIER_KEY = 'MANUAL';

/**
 * Levels seeded on first access. The frequent level is database-ONLY on purpose:
 * this store's uploads are far larger than its dump and barely change, so
 * shipping them hourly would be waste. `MANUAL` is `OFF` — never due, so only
 * the button writes there and ad-hoc runs can't eat a scheduled retention slot.
 */
const DEFAULT_TIERS = [
  { key: 'HOURLY', frequency: 'HOURLY', contents: 'DB', suffix: '/hourly', keepLast: 24, sortOrder: 1 },
  { key: 'DAILY', frequency: 'DAILY', contents: 'FULL', suffix: '/daily', keepLast: 7, sortOrder: 2 },
  { key: 'WEEKLY', frequency: 'WEEKLY', contents: 'FULL', suffix: '/weekly', keepLast: 8, sortOrder: 3 },
  { key: 'MANUAL', frequency: 'OFF', contents: 'FULL', suffix: '/manual', keepLast: 10, sortOrder: 4 },
];

/** All levels in display order, seeding the defaults on first access. */
export async function listTiers(): Promise<TierRow[]> {
  const rows = await prisma.backupTier.findMany({ orderBy: { sortOrder: 'asc' } });
  if (rows.length) return rows;
  const base = (await getRow()).remotePath.replace(/\/+$/, '');
  for (const { suffix, ...d } of DEFAULT_TIERS) {
    await prisma.backupTier.create({ data: { ...d, everyN: 1, hourUtc: 2, remotePath: `${base}${suffix}` } });
  }
  return prisma.backupTier.findMany({ orderBy: { sortOrder: 'asc' } });
}

// ── Remote transport ────────────────────────────────────────────────────────
// ssh2-sftp-client is loaded lazily so it never enters a non-node bundle, and is
// declared in next.config `serverExternalPackages` so webpack never tries to
// bundle ssh2's native addon.

/** The remote operations a backup destination must support. `dir` is always the
 *  level's absolute remote folder. */
type Transport = {
  /** The directory the account lands in — turns "permission denied" into advice. */
  homeDir: string | null;
  ensureDir(dir: string): Promise<void>;
  list(dir: string): Promise<string[]>;
  upload(localPath: string, dir: string, fileName: string): Promise<void>;
  remove(dir: string, fileName: string): Promise<void>;
};

const remoteJoin = (dir: string, name: string) => `${(dir || '/').replace(/\/+$/, '')}/${name}`;

/** Open the configured destination and run `fn` against it. Path errors are
 *  enriched with the account's real home before they surface. */
async function withTransport<T>(cfg: ConfigRow, fn: (t: Transport) => Promise<T>): Promise<T> {
  const password = decryptSecret(cfg.passwordEnc);
  if (!cfg.host || !cfg.username || !password) throw new Error('Enter host, username and password first.');

  const { default: SftpClient } = await import('ssh2-sftp-client');
  const client = new SftpClient();
  try {
    await client.connect({
      host: cfg.host,
      port: cfg.port,
      username: cfg.username,
      password,
      readyTimeout: 30_000,
    });
    const homeDir = await client.cwd().catch(() => null);
    const t: Transport = {
      homeDir,
      ensureDir: async (dir) => {
        const d = dir || '/';
        if (!(await client.exists(d))) await client.mkdir(d, true);
      },
      list: async (dir) => (await client.list(dir || '/')).map((f) => f.name),
      upload: async (localPath, dir, fileName) => {
        await client.fastPut(localPath, remoteJoin(dir, fileName));
      },
      remove: async (dir, fileName) => {
        await client.delete(remoteJoin(dir, fileName));
      },
    };
    try {
      return await fn(t);
    } catch (e) {
      throw new Error(explainPathError(e instanceof Error ? e.message : String(e), homeDir));
    }
  } finally {
    await client.end().catch(() => {});
  }
}

/** Connect and list the base folder — the cheap "are these credentials right?" check. */
export async function testBackupConnection(actorId: string | null): Promise<{ ok: boolean; message: string }> {
  const cfg = await getRow();
  let ok = false;
  let message = '';
  try {
    message = await withTransport(cfg, async (t) => {
      const dir = cfg.remotePath || '/';
      await t.ensureDir(dir);
      const list = await t.list(dir);
      ok = true;
      return `Connected over ${cfg.protocol} — ${list.length} item(s) in ${dir}.`;
    });
  } catch (e) {
    ok = false;
    message = e instanceof Error ? e.message : 'Connection failed.';
  }
  await prisma.backupConfig.update({
    where: { singleton: KEY },
    data: { lastTestAt: new Date(), lastTestOk: ok, lastTestMessage: message.slice(0, 300) },
  });
  await audit({ actorType: 'USER', actorId, action: 'backup.test', entityType: 'BackupConfig', entityId: KEY, data: { ok } });
  return { ok, message };
}

// ── Archive building ────────────────────────────────────────────────────────

/**
 * A consistent Postgres snapshot via `pg_dump -Fc` (custom format — compressed
 * and restorable with pg_restore). Runs against DATABASE_URL, so it needs the
 * `pg_dump` binary on PATH; a missing binary is reported plainly rather than as
 * a cryptic spawn error.
 */
async function snapshotDb(dest: string): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set — cannot dump the database.');
  try {
    await execFileP('pg_dump', ['--dbname', url, '-Fc', '--no-owner', '--no-privileges', '-f', dest], {
      timeout: 30 * 60_000,
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/ENOENT/.test(msg)) throw new Error('pg_dump not found on PATH — install the postgresql client tools on this server.');
    throw new Error(`pg_dump failed: ${msg.slice(0, 200)}`);
  }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Stage the selected parts and produce a .tar.gz. Returns what it ACTUALLY holds. */
async function buildArchive(kind: ArchiveKind, tmpDir: string, archivePath: string): Promise<string[]> {
  const stage = path.join(tmpDir, 'stage');
  await fs.mkdir(stage, { recursive: true });
  const entries: string[] = [];
  // A `db` archive deliberately omits uploads — the whole point of the cheap
  // frequent level.
  const withUploads = kind === 'full';

  await snapshotDb(path.join(stage, 'database.dump'));
  entries.push('database.dump');

  if (withUploads) {
    const src = path.join(process.cwd(), 'public', 'uploads');
    if (await pathExists(src)) {
      await fs.cp(src, path.join(stage, 'uploads'), { recursive: true });
      entries.push('uploads');
    }
  }

  // The manifest must describe what this archive REALLY contains, not what the
  // config asks for in general.
  const actual = contentsList({ includeDb: true, includeUploads: withUploads && entries.includes('uploads') });
  await fs.writeFile(
    path.join(stage, 'manifest.json'),
    JSON.stringify(
      { app: 'Veeey', kind, createdAt: new Date().toISOString(), contents: actual, restore: 'pg_restore -d <db> database.dump' },
      null,
      2,
    ),
  );
  entries.push('manifest.json');

  const tar = await import('tar');
  await tar.create({ gzip: true, cwd: stage, file: archivePath }, entries);
  return actual;
}

/** Upload, then prune this level's folder to its keepLast. */
async function uploadAndPrune(cfg: ConfigRow, tier: TierRow, archivePath: string, fileName: string): Promise<void> {
  await withTransport(cfg, async (t) => {
    const dir = tier.remotePath || '/';
    await t.ensureDir(dir);
    await t.upload(archivePath, dir, fileName);
    // Each level owns its folder, so retention is simply keep-newest-N in it and
    // a foreign file is never a candidate.
    const stale = prunableArchives(await t.list(dir), tier.keepLast);
    if (stale.length) console.log(`[backup] ${tier.key}: pruning ${stale.length} in ${dir}: ${stale.join(', ')}`);
    for (const name of stale) await t.remove(dir, name).catch(() => {});
  });
}

// ── Running ─────────────────────────────────────────────────────────────────

/** Run one level: snapshot → archive → upload → prune. Never throws. */
export async function runBackup(
  trigger: 'MANUAL' | 'SCHEDULED',
  actorId: string | null,
  tier: TierRow,
): Promise<{ ok: boolean; runId: string; fileName?: string; sizeBytes?: number; error?: string }> {
  const cfg = await getRow();
  const startedAt = new Date();
  const kind = contentsToKind(tier.contents);
  const run = await prisma.backupRun.create({
    data: { tierKey: tier.key, trigger, status: 'RUNNING', contents: '', },
  });
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'veeey-backup-'));
  try {
    const fileName = backupFileName(startedAt, kind);
    const archivePath = path.join(tmpDir, fileName);
    const actual = await buildArchive(kind, tmpDir, archivePath);
    const sizeBytes = (await fs.stat(archivePath)).size;
    await uploadAndPrune(cfg, tier, archivePath, fileName);
    await prisma.backupRun.update({
      where: { id: run.id },
      data: { status: 'SUCCESS', finishedAt: new Date(), fileName, sizeBytes: BigInt(sizeBytes), contents: actual.join(',') },
    });
    // Each level tracks its OWN last run — that is what keeps cadences independent.
    await prisma.backupTier.update({ where: { id: tier.id }, data: { lastRunAt: startedAt } });
    await prisma.backupConfig.update({ where: { singleton: KEY }, data: { lastRunAt: new Date() } });
    return { ok: true, runId: run.id, fileName, sizeBytes };
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Backup failed.';
    await prisma.backupRun
      .update({ where: { id: run.id }, data: { status: 'FAILED', finishedAt: new Date(), error: error.slice(0, 500) } })
      .catch(() => {});
    console.error(`[backup] ${tier.key} FAILED: ${error}`);
    if (cfg.notifyOnFailure) {
      await audit({ actorType: 'SYSTEM', action: 'backup.failed', entityType: 'BackupTier', entityId: tier.key, data: { error: error.slice(0, 300) } });
    }
    return { ok: false, runId: run.id, error };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Run ONE level immediately, whatever its schedule says — used by "Back up now"
 * (which targets MANUAL) and by each level's own Run now. `enabled` gates
 * SCHEDULING only, so an explicit request still runs a level you switched off.
 */
export async function runTierNow(
  actorId: string | null,
  key: string,
): Promise<{ ok: boolean; tier: string; fileName?: string; error?: string }> {
  const tier = (await listTiers()).find((t) => t.key === key);
  if (!tier) return { ok: false, tier: key, error: `Unknown backup level "${key}".` };
  const r = await runBackup('MANUAL', actorId, tier);
  await audit({ actorType: 'USER', actorId, action: 'backup.run', entityType: 'BackupTier', entityId: key, data: { ok: r.ok, fileName: r.fileName } });
  return { ok: r.ok, tier: tier.key, fileName: r.fileName, error: r.error };
}

/** Worker entrypoint: run EVERY level whose own schedule is due. Levels are
 *  independent — one failing or being off never blocks the others. */
export async function runDueBackups(): Promise<{ ran: number; results: Array<{ tier: string; status: string }> }> {
  const cfg = await getRow();
  if (!cfg.enabled) return { ran: 0, results: [] };
  const now = new Date();
  const results: Array<{ tier: string; status: string }> = [];
  for (const tier of await listTiers()) {
    if (!tier.enabled) continue;
    const due = isBackupDue(
      {
        frequency: tier.frequency as BackupFrequency,
        everyN: tier.everyN,
        hourUtc: tier.hourUtc,
        weekday: tier.weekday,
        dayOfMonth: tier.dayOfMonth,
      },
      tier.lastRunAt,
      now,
    );
    if (!due) continue;
    const r = await runBackup('SCHEDULED', null, tier);
    results.push({ tier: tier.key, status: r.ok ? 'SUCCESS' : 'FAILED' });
  }
  return { ran: results.length, results };
}

// ── Config I/O ──────────────────────────────────────────────────────────────

export interface SaveBackupInput {
  enabled: boolean;
  protocol: string;
  host?: string | null;
  port?: number | null;
  username?: string | null;
  /** New password. Empty/undefined = keep the stored one unchanged. */
  password?: string | null;
  remotePath?: string | null;
  notifyOnFailure: boolean;
}

export interface SaveTierInput {
  key: string;
  enabled: boolean;
  frequency: string;
  everyN?: number | null;
  hourUtc?: number | null;
  weekday?: number | null;
  dayOfMonth?: number | null;
  contents: string;
  remotePath?: string | null;
  keepLast?: number | null;
}

const clean = (v: string | null | undefined) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * Save the connection. Any field a client omits falls back to the STORED value,
 * never to a constant — a stale tab must not silently rewrite a working config
 * (this bit YeldnIN: SFTP quietly reverted to FTPS and a custom port was reset).
 */
export async function saveBackupConfig(input: SaveBackupInput, actorId: string | null): Promise<void> {
  const current = await getRow();
  const pwd = input.password?.trim();
  await prisma.backupConfig.update({
    where: { singleton: KEY },
    data: {
      enabled: input.enabled,
      protocol: isBackupProtocol(input.protocol) ? input.protocol : current.protocol,
      host: clean(input.host) ?? current.host,
      port: clampPort(input.port ?? current.port),
      username: clean(input.username) ?? current.username,
      ...(pwd ? { passwordEnc: encryptSecret(pwd) } : {}),
      remotePath: clean(input.remotePath) ?? current.remotePath,
      notifyOnFailure: input.notifyOnFailure,
    },
  });
  await audit({ actorType: 'USER', actorId, action: 'backup.save', entityType: 'BackupConfig', entityId: KEY });
}

/** Update levels. Only KNOWN keys are touched — client input can never create
 *  or delete a level. */
export async function saveTiers(inputs: SaveTierInput[], actorId: string | null): Promise<void> {
  const existing = await listTiers();
  for (const input of inputs) {
    const cur = existing.find((t) => t.key === input.key);
    if (!cur) continue;
    await prisma.backupTier.update({
      where: { id: cur.id },
      data: {
        enabled: input.enabled,
        frequency: isBackupFrequency(input.frequency) ? input.frequency : cur.frequency,
        everyN: clampEveryN(input.everyN ?? cur.everyN),
        hourUtc: clampHour(input.hourUtc ?? cur.hourUtc),
        weekday: clampWeekday(input.weekday ?? cur.weekday),
        dayOfMonth: clampDayOfMonth(input.dayOfMonth ?? cur.dayOfMonth),
        contents: isTierContents(input.contents) ? input.contents : cur.contents,
        remotePath: clean(input.remotePath) ?? cur.remotePath,
        keepLast: clampKeep(input.keepLast, cur.keepLast),
      },
    });
  }
  await audit({ actorType: 'USER', actorId, action: 'backup.tiers.save', entityType: 'BackupTier', entityId: KEY });
}

export interface BackupConfigView {
  enabled: boolean;
  protocol: string;
  host: string | null;
  port: number;
  username: string | null;
  hasPassword: boolean; // the password itself never reaches the client
  remotePath: string;
  notifyOnFailure: boolean;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastTestMessage: string | null;
  lastRunAt: string | null;
}

export interface BackupTierView {
  key: string;
  enabled: boolean;
  frequency: string;
  everyN: number;
  hourUtc: number;
  weekday: number;
  dayOfMonth: number;
  contents: string;
  remotePath: string;
  keepLast: number;
  lastRunAt: string | null;
}

export interface BackupRunView {
  id: string;
  tierKey: string | null;
  startedAt: string;
  status: string;
  trigger: string;
  contents: string;
  fileName: string | null;
  sizeBytes: number | null;
  error: string | null;
}

/** Browser-safe projection. No secrets. */
export async function backupView(): Promise<{
  config: BackupConfigView;
  tiers: BackupTierView[];
  runs: BackupRunView[];
}> {
  const [r, tiers, runs] = await Promise.all([
    getRow(),
    listTiers(),
    prisma.backupRun.findMany({ orderBy: { startedAt: 'desc' }, take: 20 }),
  ]);
  return {
    config: {
      enabled: r.enabled,
      protocol: r.protocol,
      host: r.host,
      port: r.port,
      username: r.username,
      hasPassword: !!r.passwordEnc,
      remotePath: r.remotePath,
      notifyOnFailure: r.notifyOnFailure,
      lastTestAt: r.lastTestAt?.toISOString() ?? null,
      lastTestOk: r.lastTestOk,
      lastTestMessage: r.lastTestMessage,
      lastRunAt: r.lastRunAt?.toISOString() ?? null,
    },
    tiers: tiers.map((t) => ({
      key: t.key,
      enabled: t.enabled,
      frequency: t.frequency,
      everyN: t.everyN,
      hourUtc: t.hourUtc,
      weekday: t.weekday,
      dayOfMonth: t.dayOfMonth,
      contents: t.contents,
      remotePath: t.remotePath,
      keepLast: t.keepLast,
      lastRunAt: t.lastRunAt?.toISOString() ?? null,
    })),
    runs: runs.map((x) => ({
      id: x.id,
      tierKey: x.tierKey,
      startedAt: x.startedAt.toISOString(),
      status: x.status,
      trigger: x.trigger,
      contents: x.contents,
      fileName: x.fileName,
      sizeBytes: x.sizeBytes == null ? null : Number(x.sizeBytes),
      error: x.error,
    })),
  };
}
