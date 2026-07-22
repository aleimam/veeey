import { describe, expect, it } from 'vitest';
import {
  SYNCED_DEPARTMENTS, isExcludedStaff, departmentsForTeams, reconcileDepartments, parseStaffRecord,
} from './staff-sync-logic';

describe('team → department mapping (1:1 since 2026-07-22)', () => {
  it('maps every team to the department of the SAME name', () => {
    // The name is the mapping — nothing to look up, nothing to drift.
    for (const k of SYNCED_DEPARTMENTS) expect(departmentsForTeams([k]), k).toEqual([k]);
  });

  it('no longer splits sales into pharmacist+sales', () => {
    // 'sales' now holds the permissions itself; the order-handler picker already
    // keyed off 'sales', so the second department bought nothing but confusion.
    expect(departmentsForTeams(['sales'])).toEqual(['sales']);
  });

  it('no longer collapses logistics and purchasing into operations', () => {
    // They are separate teams with their own (currently empty) permission sets,
    // which the owner tunes per store.
    expect(departmentsForTeams(['logistics'])).toEqual(['logistics']);
    expect(departmentsForTeams(['purchasing'])).toEqual(['purchasing']);
  });

  it('combines teams without duplicating, in stable order', () => {
    expect(departmentsForTeams(['sales', 'operations', 'admin'])).toEqual(['admin', 'sales', 'operations']);
    expect(departmentsForTeams(['sales', 'sales'])).toEqual(['sales']);
  });

  it('tolerates casing/whitespace and ignores unknown teams', () => {
    expect(departmentsForTeams([' Sales ', 'NOPE'])).toEqual(['sales']);
  });

  it('NEVER grants super_admin — it holds rbac.manage and must stay off the pipeline', () => {
    expect(SYNCED_DEPARTMENTS).not.toContain('super_admin');
    expect(departmentsForTeams(['super_admin'])).toEqual([]);
  });
});

describe('xoonx exclusion (owner rule)', () => {
  it('excludes a user whose ONLY team is xoonx', () => {
    expect(isExcludedStaff(['xoonx'])).toBe(true);
  });

  it('does NOT exclude someone in xoonx AND a real team', () => {
    expect(isExcludedStaff(['xoonx', 'sales'])).toBe(false);
    expect(departmentsForTeams(['xoonx', 'sales'])).toEqual(['sales']); // xoonx contributes nothing
  });

  it('a user with no teams at all is not "excluded" — they just get no departments', () => {
    expect(isExcludedStaff([])).toBe(false);
    expect(departmentsForTeams([])).toEqual([]);
  });
});

describe('reconcile — the add/revoke plan', () => {
  it('grants what the teams entitle and revokes what they no longer do', () => {
    const p = reconcileDepartments(['operations'], ['sales']);
    expect(p.add).toEqual(['sales']);
    expect(p.remove).toEqual(['operations']);
  });

  it('NEVER touches departments outside the synced set', () => {
    // super_admin is hand-assigned; omission must not remove it.
    const p = reconcileDepartments(['super_admin', 'operations'], ['operations']);
    expect(p.add).toEqual([]);
    expect(p.remove).toEqual([]);
  });

  it('an inactive user (desired = []) loses every synced department — that IS the revocation', () => {
    const p = reconcileDepartments(['admin', 'sales', 'super_admin'], []);
    expect(p.remove).toEqual(['admin', 'sales']);
    expect(p.remove).not.toContain('super_admin'); // still not ours to remove
  });

  it('is a no-op when already correct', () => {
    expect(reconcileDepartments(['sales', 'admin'], ['admin', 'sales'])).toEqual({ add: [], remove: [] });
  });
});

describe('parseStaffRecord', () => {
  const ok = { email: 'Ali@Yeldn.com ', name: ' Ali ', username: ' ali ', phone: ' +2010 ', active: true, teams: ['sales'] };

  it('normalises email/name/username and keeps teams', () => {
    expect(parseStaffRecord(ok)).toEqual({ email: 'ali@yeldn.com', name: 'Ali', username: 'ali', phone: '+2010', active: true, teams: ['sales'], avatar: null });
  });

  it('accepts only sane inline avatars (image mime, capped base64) — else null', () => {
    const img = { mime: 'image/png', base64: 'aGVsbG8=' };
    expect(parseStaffRecord({ ...ok, avatar: img })!.avatar).toEqual(img);
    expect(parseStaffRecord({ ...ok, avatar: { mime: 'application/pdf', base64: 'aGVsbG8=' } })!.avatar).toBeNull();
    expect(parseStaffRecord({ ...ok, avatar: { mime: 'image/png', base64: 'x'.repeat(700_000) } })!.avatar).toBeNull();
    expect(parseStaffRecord({ ...ok, avatar: 'not-an-object' })!.avatar).toBeNull();
    expect(parseStaffRecord(ok)!.avatar).toBeNull();
  });

  it('treats anything but an explicit true as INACTIVE (safe direction for access)', () => {
    expect(parseStaffRecord({ ...ok, active: 'yes' })!.active).toBe(false);
    expect(parseStaffRecord({ ...ok, active: undefined })!.active).toBe(false);
    expect(parseStaffRecord({ ...ok, active: 1 })!.active).toBe(false);
  });

  it('rejects a record with no usable email — we match people by email', () => {
    expect(parseStaffRecord({ ...ok, email: '' })).toBeNull();
    expect(parseStaffRecord({ ...ok, email: 'not-an-email' })).toBeNull();
    expect(parseStaffRecord(null)).toBeNull();
  });

  it('falls back to the email when a name is missing, rather than dropping the person', () => {
    expect(parseStaffRecord({ ...ok, name: '  ' })!.name).toBe('ali@yeldn.com');
  });
});
