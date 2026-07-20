import { describe, it, expect } from 'vitest';
import {
  ARCHIVE_PREFIX,
  backupFileName,
  parseArchiveName,
  ourArchives,
  prunableArchives,
  lastScheduledFireTime,
  isBackupDue,
  contentsToKind,
  isTierContents,
  isBackupProtocol,
  defaultPortFor,
  clampEveryN,
  clampPort,
  normalizeArchivePrefix,
  libpqUrl,
  redactUrl,
  clampKeep,
  explainPathError,
  contentsList,
  formatBytes,
  type Schedule,
} from './backup-logic';

const at = (iso: string) => new Date(iso);
const nm = (kind: 'db' | 'full', iso: string) => backupFileName(at(iso), kind);
const DAY = 86_400_000;

describe('shared-storage safety', () => {
  it('uses veeey-backup- so it can never touch another app on the same box', () => {
    expect(ARCHIVE_PREFIX).toBe('veeey-backup-');
    expect(nm('full', '2026-07-20T02:00:00Z')).toBe('veeey-backup-full-20260720-020000.tar.gz');
  });

  it("refuses to recognise another app's archives", () => {
    // YeldnIN shares this Storage Box — its files must be invisible to us
    expect(parseArchiveName('yeldnin-backup-full-20260719-230905.tar.gz')).toBeNull();
    expect(parseArchiveName('noc-backup-db-20260719-230905.tar.gz')).toBeNull();
    expect(prunableArchives(['yeldnin-backup-db-20260719-230903.tar.gz'], 0)).toEqual([]);
    expect(prunableArchives(['yeldnin-backup-db-20260719-230903.tar.gz'], 1)).toEqual([]);
  });

  it('refuses anything that is not a well-formed archive name', () => {
    expect(parseArchiveName('notes.txt')).toBeNull();
    expect(parseArchiveName('veeey-backup-db-2026-07-19.tar.gz')).toBeNull();
    expect(parseArchiveName('veeey-backup-weekly-20260719-000000.tar.gz')).toBeNull();
  });
});

describe('archive naming + ordering', () => {
  it('round-trips kind + timestamp', () => {
    const p = parseArchiveName(nm('db', '2026-07-19T21:34:05Z'))!;
    expect(p.kind).toBe('db');
    expect(p.at.toISOString()).toBe('2026-07-19T21:34:05.000Z');
  });

  it('orders by timestamp, not lexically (kinds interleave)', () => {
    const older = nm('full', '2026-07-19T02:00:00Z');
    const newer = nm('db', '2026-07-19T21:00:00Z');
    // lexically "db" < "full", so a naive string sort gets this backwards
    expect(ourArchives([older, newer])[0]).toBe(newer);
  });
});

describe('retention', () => {
  const names = Array.from({ length: 10 }, (_, i) =>
    nm('full', new Date(Date.UTC(2026, 6, 19, 2) - i * DAY).toISOString()),
  );

  it('keeps the newest N and deletes the rest', () => {
    const del = prunableArchives(names, 3);
    expect(del).toHaveLength(7);
    for (const keep of names.slice(0, 3)) expect(del).not.toContain(keep);
  });

  it('keep=0 means keep everything', () => {
    expect(prunableArchives(names, 0)).toEqual([]);
  });

  it('never deletes the newest archive when keeping at least one', () => {
    expect(prunableArchives(names, 1)).not.toContain(ourArchives(names)[0]);
  });

  it('ignores foreign files entirely', () => {
    const del = prunableArchives([...names, 'readme.txt', 'yeldnin-backup-full-20200101-000000.tar.gz'], 1);
    expect(del).not.toContain('readme.txt');
    expect(del).not.toContain('yeldnin-backup-full-20200101-000000.tar.gz');
  });
});

describe('scheduling — everyN', () => {
  const base = { hourUtc: 2, weekday: 0, dayOfMonth: 15 };

  it('everyN=1 matches the plain behaviour', () => {
    const now = at('2026-07-19T09:40:00Z');
    for (const frequency of ['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY'] as const) {
      const a = lastScheduledFireTime({ frequency, everyN: 1, ...base }, now)!;
      const b = lastScheduledFireTime({ frequency, ...base }, now)!;
      expect(a.toISOString()).toBe(b.toISOString());
    }
  });

  it('OFF never fires (this is how the MANUAL level stays button-only)', () => {
    const s: Schedule = { frequency: 'OFF', ...base };
    expect(lastScheduledFireTime(s, new Date())).toBeNull();
    expect(isBackupDue(s, null, new Date())).toBe(false);
  });

  it('HOURLY every 2 lands on even UTC hours', () => {
    const s: Schedule = { frequency: 'HOURLY', everyN: 2, ...base };
    expect(lastScheduledFireTime(s, at('2026-07-19T09:40:00Z'))!.toISOString()).toBe('2026-07-19T08:00:00.000Z');
    expect(lastScheduledFireTime(s, at('2026-07-19T00:05:00Z'))!.toISOString()).toBe('2026-07-19T00:00:00.000Z');
  });

  it('HOURLY every 6 lands on 00/06/12/18', () => {
    const s: Schedule = { frequency: 'HOURLY', everyN: 6, ...base };
    expect(lastScheduledFireTime(s, at('2026-07-19T13:59:00Z'))!.toISOString()).toBe('2026-07-19T12:00:00.000Z');
  });

  it('DAILY every 2 fires at hourUtc, on an every-other-day slot, never ahead of now', () => {
    const s: Schedule = { frequency: 'DAILY', everyN: 2, ...base };
    for (const iso of ['2026-07-19T09:40:00Z', '2026-07-20T01:00:00Z', '2026-07-21T23:59:00Z']) {
      const now = at(iso);
      const fire = lastScheduledFireTime(s, now)!;
      expect(fire.getTime()).toBeLessThanOrEqual(now.getTime());
      expect(fire.getUTCHours()).toBe(2);
      expect(Math.floor(fire.getTime() / DAY) % 2).toBe(0);
      expect(now.getTime() - fire.getTime()).toBeLessThan(3 * DAY);
    }
  });

  it('WEEKLY every 2 fires on the chosen weekday, every other week', () => {
    const s: Schedule = { frequency: 'WEEKLY', everyN: 2, hourUtc: 3, weekday: 0, dayOfMonth: 1 };
    for (const iso of ['2026-07-19T09:40:00Z', '2026-07-25T12:00:00Z', '2026-08-01T00:00:00Z']) {
      const now = at(iso);
      const fire = lastScheduledFireTime(s, now)!;
      expect(fire.getTime()).toBeLessThanOrEqual(now.getTime());
      expect(fire.getUTCDay()).toBe(0);
      expect(Math.floor(fire.getTime() / (7 * DAY)) % 2).toBe(0);
    }
  });

  it('MONTHLY every 3 fires on the chosen day, every third month', () => {
    const s: Schedule = { frequency: 'MONTHLY', everyN: 3, hourUtc: 4, weekday: 0, dayOfMonth: 15 };
    for (const iso of ['2026-07-19T09:40:00Z', '2026-01-02T00:00:00Z', '2026-12-31T23:00:00Z']) {
      const now = at(iso);
      const fire = lastScheduledFireTime(s, now)!;
      expect(fire.getTime()).toBeLessThanOrEqual(now.getTime());
      expect(fire.getUTCDate()).toBe(15);
      expect((fire.getUTCFullYear() * 12 + fire.getUTCMonth()) % 3).toBe(0);
    }
  });

  it('does not drift — slots are epoch-anchored, not relative to the last run', () => {
    const s: Schedule = { frequency: 'HOURLY', everyN: 4, ...base };
    for (const h of [0, 3, 7, 11, 15, 19, 23]) {
      const fire = lastScheduledFireTime(s, at(`2026-07-19T${String(h).padStart(2, '0')}:37:00Z`))!;
      expect(fire.getUTCHours() % 4).toBe(0);
      expect(fire.getUTCMinutes()).toBe(0);
    }
  });

  it('isBackupDue respects the interval', () => {
    const s: Schedule = { frequency: 'HOURLY', everyN: 6, ...base };
    const now = at('2026-07-19T13:00:00Z'); // last slot was 12:00
    expect(isBackupDue(s, at('2026-07-19T12:30:00Z'), now)).toBe(false);
    expect(isBackupDue(s, at('2026-07-19T11:00:00Z'), now)).toBe(true);
    expect(isBackupDue(s, null, now)).toBe(true);
  });
});

describe('helpers', () => {
  it('maps contents onto the archive kind', () => {
    expect(contentsToKind('DB')).toBe('db');
    expect(contentsToKind('FULL')).toBe('full');
    expect(contentsToKind('nonsense')).toBe('full'); // safe default: more, not less
  });

  it('validates and clamps', () => {
    expect(isTierContents('DB')).toBe(true);
    expect(isTierContents('db')).toBe(false);
    expect(isBackupProtocol('SFTP')).toBe(true);
    // 23, not 22 — the Storage Box's port 22 is chrooted and silently nests
    // the remote path (BACKUP.md §8.1). Must agree with clampPort's fallback.
    expect(defaultPortFor('SFTP')).toBe(23);
    expect(clampPort('nonsense')).toBe(23);
    expect(clampEveryN(0)).toBe(1);
    expect(clampEveryN(99999)).toBe(365);
    expect(clampKeep(undefined, 7)).toBe(7);
    expect(clampKeep(-3, 7)).toBe(0);
  });

  it('explains a path error with the writable home', () => {
    const out = explainPathError('Bad path: /backup permission denied', '/home');
    expect(out).toContain('can only write inside');
    expect(out).toContain('/home/daily');
    expect(explainPathError('Timeout (control socket)', '/home')).toBe('Timeout (control socket)');
    expect(explainPathError('permission denied', null)).toBe('permission denied');
  });

  it('lists contents and formats sizes', () => {
    expect(contentsList({ includeDb: true, includeUploads: false })).toEqual(['db']);
    expect(contentsList({ includeDb: true, includeUploads: true })).toEqual(['db', 'uploads']);
    expect(formatBytes(0)).toBe('—');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('per-store archive prefix (two stores, one Storage Box)', () => {
  const NET = 'veeey-net-backup-';

  it('normalizes: empty/unset falls back to the default', () => {
    expect(normalizeArchivePrefix(undefined)).toBe(ARCHIVE_PREFIX);
    expect(normalizeArchivePrefix('')).toBe(ARCHIVE_PREFIX);
    expect(normalizeArchivePrefix('   ')).toBe(ARCHIVE_PREFIX);
  });

  it('normalizes: appends the trailing dash so the name never runs together', () => {
    expect(normalizeArchivePrefix('veeey-net-backup')).toBe(NET);
    expect(normalizeArchivePrefix('veeey-net-backup-')).toBe(NET);
  });

  it('normalizes: rejects anything that would corrupt a path or the parser regex', () => {
    // A slash would change the remote directory; whitespace breaks listings.
    expect(normalizeArchivePrefix('../escape')).toBe(ARCHIVE_PREFIX);
    expect(normalizeArchivePrefix('two words')).toBe(ARCHIVE_PREFIX);
    expect(normalizeArchivePrefix('a/b')).toBe(ARCHIVE_PREFIX);
  });

  it('names archives with the store prefix', () => {
    const at = new Date(Date.UTC(2026, 6, 20, 2, 0, 33));
    expect(backupFileName(at, 'db', NET)).toBe('veeey-net-backup-db-20260720-020033.tar.gz');
    expect(backupFileName(at, 'db')).toBe('veeey-backup-db-20260720-020033.tar.gz');
  });

  it('THE POINT: each store sees the other store\'s archives as foreign', () => {
    const com = 'veeey-backup-db-20260720-020033.tar.gz';
    const net = 'veeey-net-backup-db-20260720-020033.tar.gz';
    // veeey.net's pruner must not recognise veeey.com's file…
    expect(parseArchiveName(com, NET)).toBeNull();
    expect(parseArchiveName(net, NET)).not.toBeNull();
    // …and vice versa. Note `veeey-backup-` is NOT a prefix of the .net name,
    // so this holds in both directions rather than only one.
    expect(parseArchiveName(net, ARCHIVE_PREFIX)).toBeNull();
    expect(parseArchiveName(com, ARCHIVE_PREFIX)).not.toBeNull();
  });

  it('THE POINT: retention never deletes the other store\'s archives, even at keep=1', () => {
    const listing = [
      'veeey-backup-full-20260718-020000.tar.gz',
      'veeey-backup-full-20260719-020000.tar.gz',
      'veeey-net-backup-full-20260718-020000.tar.gz',
      'veeey-net-backup-full-20260719-020000.tar.gz',
    ];
    // If both stores were ever pointed at ONE folder, each prunes only its own.
    const netPrunes = prunableArchives(listing, 1, NET);
    expect(netPrunes).toEqual(['veeey-net-backup-full-20260718-020000.tar.gz']);
    const comPrunes = prunableArchives(listing, 1, ARCHIVE_PREFIX);
    expect(comPrunes).toEqual(['veeey-backup-full-20260718-020000.tar.gz']);
  });

  it('a prefix containing a regex metacharacter is matched literally', () => {
    // normalizeArchivePrefix permits ".", which is a regex wildcard unescaped.
    const dotted = normalizeArchivePrefix('veeey.net-backup');
    expect(dotted).toBe('veeey.net-backup-');
    expect(parseArchiveName('veeey.net-backup-db-20260720-020033.tar.gz', dotted)).not.toBeNull();
    // "veeeyXnet-..." must NOT match — it would if "." stayed a wildcard.
    expect(parseArchiveName('veeeyXnet-backup-db-20260720-020033.tar.gz', dotted)).toBeNull();
  });
});

describe('libpqUrl (veeey.net backups failed on Prisma-only params)', () => {
  it('strips ?schema=public — the exact param that broke veeey.net', () => {
    // pg_dump: `invalid URI query parameter: "schema"` → the whole backup failed.
    expect(libpqUrl('postgresql://u:p@127.0.0.1:5432/veeey?schema=public'))
      .toBe('postgresql://u:p@127.0.0.1:5432/veeey');
  });

  it('KEEPS parameters libpq understands', () => {
    const out = libpqUrl('postgresql://u:p@h:5432/db?sslmode=require&application_name=veeey');
    expect(out).toContain('sslmode=require');
    expect(out).toContain('application_name=veeey');
  });

  it('strips only the Prisma-only ones from a mixed query string', () => {
    const out = libpqUrl('postgresql://u:p@h:5432/db?schema=public&sslmode=require&connection_limit=5&pgbouncer=true');
    expect(out).toBe('postgresql://u:p@h:5432/db?sslmode=require');
  });

  it('leaves a clean URL untouched (veeey.com\'s case)', () => {
    const clean = 'postgresql://u:p@127.0.0.1:5432/veeey';
    expect(libpqUrl(clean)).toBe(clean);
  });

  it('returns unparseable input unchanged, so pg_dump reports its own error', () => {
    expect(libpqUrl('not a url')).toBe('not a url');
  });
});

describe('redactUrl (a failed backup printed the DB password into the admin UI)', () => {
  it('removes the password from a pg_dump failure message', () => {
    const real = 'Command failed: pg_dump --dbname postgresql://veeey:s3cr3tpw@127.0.0.1:5432/veeey -Fc';
    const out = redactUrl(real);
    expect(out).not.toContain('s3cr3tpw');
    expect(out).toContain('postgresql://veeey:***@127.0.0.1:5432/veeey');
  });

  it('handles multiple URLs and mysql too (net-sync uses one)', () => {
    const out = redactUrl('a postgres://x:aaa@h/d and mysql://y:bbb@h/d');
    expect(out).not.toContain('aaa');
    expect(out).not.toContain('bbb');
  });

  it('leaves text without credentials alone', () => {
    expect(redactUrl('pg_dump not found on PATH')).toBe('pg_dump not found on PATH');
  });
});
