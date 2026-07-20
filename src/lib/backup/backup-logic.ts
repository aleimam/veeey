// Pure backup scheduling + archive-naming + retention logic. No DB/IO, no
// imports — keep it that way so vitest never drags next-auth in (see AGENTS.md
// "Keep pure helpers in import-clean modules"). Spec: ../../../BACKUP.md

export const BACKUP_FREQUENCIES = ['OFF', 'HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY'] as const;
export type BackupFrequency = (typeof BACKUP_FREQUENCIES)[number];

/**
 * SFTP only — deliberately. FTPS cannot reach the Storage Box from these
 * servers at all: the host resolves IPv6-first and its FTP server can't build an
 * IPv6 passive listener, and even over IPv4 the passive data port is refused by
 * the CSF outbound firewall, which the FTP conntrack helper can't rescue because
 * TLS hides the control channel. Offering it would only be a trap. (BACKUP.md §8.2)
 */
export const BACKUP_PROTOCOLS = ['SFTP'] as const;
export type BackupProtocol = (typeof BACKUP_PROTOCOLS)[number];

/**
 * ⚠ SHARED STORAGE: every app on the Storage Box must use its OWN prefix. This
 * is what stops one app's retention deleting another's archives — the parser
 * only ever recognises files starting with this. Never change it to match
 * another app's. (BACKUP.md §2)
 */
export const ARCHIVE_PREFIX = 'veeey-backup-';

export function isBackupFrequency(v: unknown): v is BackupFrequency {
  return typeof v === 'string' && (BACKUP_FREQUENCIES as readonly string[]).includes(v);
}
export function isBackupProtocol(v: unknown): v is BackupProtocol {
  return typeof v === 'string' && (BACKUP_PROTOCOLS as readonly string[]).includes(v);
}

/**
 * Conventional port per protocol. Only a UI default: a Hetzner Storage Box
 * serves SSH/SFTP on **23**, so the field stays editable.
 *
 * Prefer SFTP: it moves data over the SAME connection, whereas FTPS opens a
 * second "passive" connection on a random high port, which a restrictive
 * outbound firewall blocks and the kernel's FTP conntrack helper cannot rescue
 * (TLS hides the control channel). See BACKUP.md §8.2.
 */
/**
 * 23, not the usual 22: the Hetzner Storage Box serves SSH/SFTP on **23**.
 * Port 22 also answers there but is chrooted to the account home, so the same
 * remote path silently resolves to a DIFFERENT directory — writing `/home/x`
 * over 22 creates `/home/home/x` and the run still reports success
 * (BACKUP.md §8.1). Defaulting to 22 would hand that trap to anyone who wires
 * this into the form, so the default matches the schema's and clampPort's 23.
 */
export const defaultPortFor = (p: BackupProtocol): number => (p === 'SFTP' ? 23 : 21);

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.round(v)));
}
export const clampHour = (n: unknown) => clampInt(n, 0, 23, 2);
export const clampWeekday = (n: unknown) => clampInt(n, 0, 6, 0);
export const clampDayOfMonth = (n: unknown) => clampInt(n, 1, 28, 1);
export const clampPort = (n: unknown) => clampInt(n, 1, 65535, 23);
/** Per-level "keep last N". 0 = keep all. Capped so a typo can't ask for an
 *  absurd history; each level carries its own sensible default. */
export const clampKeep = (n: unknown, fallback: number) => clampInt(n, 0, 1000, fallback);
/** Interval multiplier for a level's frequency ("every N hours/days/…"). */
export const clampEveryN = (n: unknown) => clampInt(n, 1, 365, 1);

/** What a level's archives contain. */
export const TIER_CONTENTS = ['DB', 'FULL'] as const;
export type TierContents = (typeof TIER_CONTENTS)[number];
export function isTierContents(v: unknown): v is TierContents {
  return typeof v === 'string' && (TIER_CONTENTS as readonly string[]).includes(v);
}

export const ARCHIVE_KINDS = ['db', 'full'] as const;
export type ArchiveKind = (typeof ARCHIVE_KINDS)[number];

/** A level's contents choice as the archive kind that names its files. */
export const contentsToKind = (c: string): ArchiveKind => (c === 'DB' ? 'db' : 'full');

export interface Schedule {
  frequency: BackupFrequency;
  /** Interval multiplier — every N hours/days/weeks/months. Defaults to 1. */
  everyN?: number;
  hourUtc: number;
  weekday: number; // 0=Sun..6=Sat
  dayOfMonth: number; // 1..28
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const WEEK_MS = 7 * DAY_MS;

/** Modulo that stays non-negative for pre-1970 indices. */
const mod = (a: number, n: number) => ((a % n) + n) % n;

/**
 * The most recent moment the schedule should have fired at or before `now` (all
 * UTC), or null when the schedule is OFF.
 *
 * `everyN` selects every Nth slot, anchored to FIXED epoch boundaries rather
 * than to the previous run — so "every 2 hours" is always the even UTC hours and
 * a late or missed run can never shift the whole series (no drift). N = 1 is
 * exactly the plain behaviour.
 */
export function lastScheduledFireTime(s: Schedule, now: Date): Date | null {
  if (s.frequency === 'OFF') return null;
  const n = Math.max(1, Math.floor(s.everyN ?? 1));
  const t = now.getTime();
  const guardMax = 5000; // bounded walk-back; everyN is clamped well below this

  if (s.frequency === 'HOURLY') {
    const slot = Math.floor(t / HOUR_MS);
    return new Date((slot - mod(slot, n)) * HOUR_MS);
  }

  const y = now.getUTCFullYear();
  const mo = now.getUTCMonth();
  const d = now.getUTCDate();

  if (s.frequency === 'DAILY') {
    let fire = Date.UTC(y, mo, d, s.hourUtc, 0, 0, 0);
    if (fire > t) fire -= DAY_MS;
    for (let i = 0; mod(Math.floor(fire / DAY_MS), n) !== 0 && i < guardMax; i++) fire -= DAY_MS;
    return new Date(fire);
  }

  if (s.frequency === 'WEEKLY') {
    let fire = Date.UTC(y, mo, d, s.hourUtc, 0, 0, 0) - mod(now.getUTCDay() - s.weekday, 7) * DAY_MS;
    if (fire > t) fire -= WEEK_MS;
    for (let i = 0; mod(Math.floor(fire / WEEK_MS), n) !== 0 && i < guardMax; i++) fire -= WEEK_MS;
    return new Date(fire);
  }

  // MONTHLY (dayOfMonth capped at 28 so every month has it)
  const dom = Math.min(Math.max(s.dayOfMonth, 1), 28);
  // `mm` may go negative — Date.UTC normalises that into the previous year, and
  // (yy*12 + mm) stays a correct continuous month index, so yy never changes.
  const yy = y;
  let mm = mo;
  if (Date.UTC(yy, mm, dom, s.hourUtc, 0, 0, 0) > t) mm -= 1;
  for (let i = 0; mod(yy * 12 + mm, n) !== 0 && i < guardMax; i++) mm -= 1;
  return new Date(Date.UTC(yy, mm, dom, s.hourUtc, 0, 0, 0));
}

/** Should this level run now? True when its schedule has fired since its last run. */
export function isBackupDue(s: Schedule, lastRunAt: Date | null, now: Date): boolean {
  const fire = lastScheduledFireTime(s, now);
  if (!fire) return false;
  return lastRunAt == null || lastRunAt.getTime() < fire.getTime();
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `veeey-backup-<kind>-YYYYMMDD-HHmmss.tar.gz`, stamped in UTC. */
export function backupFileName(now: Date, kind: ArchiveKind = 'full'): string {
  const stamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  return `${ARCHIVE_PREFIX}${kind}-${stamp}.tar.gz`;
}

const STAMP = String.raw`(\d{8})-(\d{6})`;
const KINDED = new RegExp(`^${ARCHIVE_PREFIX}(db|full)-${STAMP}\\.tar\\.gz$`);

function stampToDate(ymd: string, hms: string): Date | null {
  const d = new Date(
    Date.UTC(
      Number(ymd.slice(0, 4)),
      Number(ymd.slice(4, 6)) - 1,
      Number(ymd.slice(6, 8)),
      Number(hms.slice(0, 2)),
      Number(hms.slice(2, 4)),
      Number(hms.slice(4, 6)),
    ),
  );
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * Recognise one of OUR archives and read its kind + timestamp. Returns null for
 * anything else — foreign files (including another app's archives on the shared
 * box) must never become deletion candidates.
 */
export function parseArchiveName(name: string): { kind: ArchiveKind; at: Date } | null {
  const m = KINDED.exec(name);
  if (!m) return null;
  const at = stampToDate(m[2], m[3]);
  return at ? { kind: m[1] as ArchiveKind, at } : null;
}

/** Our archives in a remote listing, newest-first BY TIMESTAMP — with a kind
 *  segment in the name, lexical order is no longer chronological. */
export function ourArchives(names: string[]): string[] {
  return names
    .map((n) => ({ n, p: parseArchiveName(n) }))
    .filter((x): x is { n: string; p: { kind: ArchiveKind; at: Date } } => x.p !== null)
    .sort((a, b) => b.p.at.getTime() - a.p.at.getTime())
    .map((x) => x.n);
}

/**
 * Which files to DELETE to keep only the newest `keep` in this folder.
 * `keep <= 0` keeps everything.
 *
 * Safety, because this deletes real backups: unparseable/foreign files are never
 * returned, and with `keep >= 1` the newest archive can never be returned.
 */
export function prunableArchives(names: string[], keep: number): string[] {
  if (keep <= 0) return [];
  return ourArchives(names).slice(keep);
}

/**
 * Turn a bare remote path error into an actionable one. Servers answer a path
 * outside the account's home with just "permission denied" / "Bad path", never
 * saying what IS writable — and a Storage Box sub-account presents its base dir
 * as `/home`, which nobody guesses. Non-path errors pass through untouched.
 */
export function explainPathError(message: string, homeDir: string | null): string {
  if (!homeDir) return message;
  if (!/permission denied|bad path|no such file|denied|not found/i.test(message)) return message;
  const home = homeDir.replace(/\/+$/, '');
  return `${message} — this account can only write inside "${homeDir}", so the remote folder must start with it (e.g. "${home}/daily").`;
}

/** The included parts as a stable csv list, e.g. ["db","uploads"]. */
export function contentsList(c: { includeDb: boolean; includeUploads: boolean }): string[] {
  const out: string[] = [];
  if (c.includeDb) out.push('db');
  if (c.includeUploads) out.push('uploads');
  return out;
}

/** Human file size (used in the run log). */
export function formatBytes(n: number | null | undefined): string {
  if (!n || n <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}
