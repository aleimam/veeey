import { describe, expect, it } from 'vitest';
import {
  SYNCED_DEPARTMENTS, isExcludedStaff, departmentsForTeams, reconcileDepartments, parseStaffRecord,
} from './staff-sync-logic';

describe('team → department mapping', () => {
  it('sales grants BOTH pharmacist and sales', () => {
    // pharmacist carries orders.write (Status Matrix: only Sales confirm);
    // `sales` alone is just the handler picker and grants nothing.
    expect(departmentsForTeams(['sales'])).toEqual(['pharmacist', 'sales']);
  });

  it('operations, logistics and purchasing all collapse to Operations', () => {
    expect(departmentsForTeams(['logistics'])).toEqual(['operations']);
    expect(departmentsForTeams(['purchasing'])).toEqual(['operations']);
    expect(departmentsForTeams(['logistics', 'operations', 'purchasing'])).toEqual(['operations']);
  });

  it('couriers maps to Courier; development maps to nothing', () => {
    expect(departmentsForTeams(['couriers'])).toEqual(['courier']);
    expect(departmentsForTeams(['development'])).toEqual([]);
  });

  it('combines teams without duplicating, in stable order', () => {
    expect(departmentsForTeams(['sales', 'operations', 'admin'])).toEqual(['admin', 'pharmacist', 'sales', 'operations']);
    expect(departmentsForTeams(['sales', 'sales'])).toEqual(['pharmacist', 'sales']);
  });

  it('tolerates casing/whitespace and ignores unknown teams', () => {
    expect(departmentsForTeams([' Sales ', 'NOPE'])).toEqual(['pharmacist', 'sales']);
  });
});

describe('xoonx exclusion (owner rule)', () => {
  it('excludes a user whose ONLY team is xoonx', () => {
    expect(isExcludedStaff(['xoonx'])).toBe(true);
  });

  it('does NOT exclude someone in xoonx AND a real team — they are still a salesperson', () => {
    expect(isExcludedStaff(['xoonx', 'sales'])).toBe(false);
    expect(departmentsForTeams(['xoonx', 'sales'])).toEqual(['pharmacist', 'sales']); // xoonx contributes nothing
  });

  it('a user with no teams at all is not "excluded" — they just get no departments', () => {
    expect(isExcludedStaff([])).toBe(false);
    expect(departmentsForTeams([])).toEqual([]);
  });
});

describe('reconcile — the add/revoke plan', () => {
  it('grants what the teams entitle and revokes what they no longer do', () => {
    const p = reconcileDepartments(['operations'], ['pharmacist', 'sales']);
    expect(p.add).toEqual(['pharmacist', 'sales']);
    expect(p.remove).toEqual(['operations']);
  });

  it('NEVER touches departments outside the synced set', () => {
    // Marketing/Finance/Super Admin are hand-assigned; omission must not remove them.
    const p = reconcileDepartments(['marketing', 'finance', 'super_admin', 'operations'], ['operations']);
    expect(p.add).toEqual([]);
    expect(p.remove).toEqual([]);
  });

  it('an inactive user (desired = []) loses every synced department — that IS the revocation', () => {
    const p = reconcileDepartments(['admin', 'pharmacist', 'sales', 'marketing'], []);
    expect(p.remove).toEqual(['admin', 'pharmacist', 'sales']);
    expect(p.remove).not.toContain('marketing'); // still not ours to remove
  });

  it('is a no-op when already correct', () => {
    const p = reconcileDepartments(['pharmacist', 'sales'], ['sales', 'pharmacist']);
    expect(p).toEqual({ add: [], remove: [] });
  });

  it('only ever plans changes within the owned set', () => {
    const p = reconcileDepartments([], ['marketing' as never, 'operations']);
    expect(p.add).toEqual(['operations']);
    expect(SYNCED_DEPARTMENTS).not.toContain('marketing' as never);
  });
});

describe('parseStaffRecord', () => {
  const ok = { email: 'Ali@Yeldn.com ', name: ' Ali ', username: ' ali ', phone: ' +2010 ', active: true, teams: ['sales'] };

  it('normalises email/name/username and keeps teams', () => {
    expect(parseStaffRecord(ok)).toEqual({ email: 'ali@yeldn.com', name: 'Ali', username: 'ali', phone: '+2010', active: true, teams: ['sales'] });
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
