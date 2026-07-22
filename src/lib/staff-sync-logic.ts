/**
 * Staff sync: YeldnIN teams → Veeey departments. PURE (no DB/IO) because this
 * decides who gains and loses admin access, and that has to be testable.
 *
 * One-way, YeldnIN is the source of truth for WHO works here and on WHICH team.
 *
 * SCOPED-AUTHORITATIVE: the sync owns only the departments that mirror a YeldnIN
 * team (below). Inside that set it reconciles exactly — joining a team grants,
 * leaving revokes. Outside it (Marketing, Finance, Content/SEO, Customer Support,
 * Super Admin) it never touches anything, so hand-made assignments survive.
 */

/**
 * Departments this sync may ADD or REMOVE — one per YeldnIN team, same key.
 *
 * 1:1 since 2026-07-22 (owner). The old mapping split `sales` into
 * pharmacist+sales and collapsed logistics/purchasing into operations, which
 * meant nobody could tell from a department name what it corresponded to. Now
 * the name IS the mapping, so there is nothing to look up and nothing to drift.
 *
 * `super_admin` is deliberately ABSENT. It is the sole holder of `rbac.manage`
 * — the power to rewrite the permission model — and keeping it out of the sync
 * is what guarantees no automated pipeline can ever grant that. Only a human,
 * acting directly in Veeey, can.
 */
export const SYNCED_DEPARTMENTS = [
  'admin', 'sales', 'operations', 'logistics', 'purchasing', 'couriers',
  'development', 'marketing', 'finance', 'content_seo', 'support',
] as const;
export type SyncedDepartment = (typeof SYNCED_DEPARTMENTS)[number];

/**
 * YeldnIN team → Veeey department. Identity, by design.
 *
 * What each department GRANTS is defined independently on each side (owner:
 * "Departments for HR, Teams for permissions; permissions defined separately").
 * So `logistics` and `purchasing` exist here with zero permissions until the
 * owner tunes them — membership mirrors, authority does not.
 *
 * `xoonx` is simply absent — an unlisted team resolves to no departments, and a
 * user whose ONLY team is xoonx is excluded outright by `isExcludedStaff`.
 */
export const TEAM_TO_DEPARTMENTS: Record<string, SyncedDepartment[]> = Object.fromEntries(
  SYNCED_DEPARTMENTS.map((d) => [d, [d]]),
);

export const XOONX_TEAM = 'xoonx';

/**
 * Owner rule: xoonx is a separate business line, so a user whose ONLY team is
 * xoonx gets no Veeey account at all. Someone in xoonx *and* sales is a real
 * salesperson — they're included, and only their non-xoonx teams map.
 */
export function isExcludedStaff(teams: readonly string[]): boolean {
  const t = teams.map((x) => x.trim().toLowerCase()).filter(Boolean);
  return t.length > 0 && t.every((x) => x === XOONX_TEAM);
}

/** The departments a user's teams entitle them to (deduped, stable order). */
export function departmentsForTeams(teams: readonly string[]): SyncedDepartment[] {
  const out = new Set<SyncedDepartment>();
  for (const raw of teams) {
    for (const d of TEAM_TO_DEPARTMENTS[raw.trim().toLowerCase()] ?? []) out.add(d);
  }
  return SYNCED_DEPARTMENTS.filter((d) => out.has(d));
}

export type ReconcilePlan = { add: SyncedDepartment[]; remove: SyncedDepartment[] };

/**
 * What to change for one user. `current` is their FULL department list; only the
 * synced subset is ever considered, so unmanaged departments can't be removed by
 * omission.
 *
 * An inactive user resolves to `desired = []`, which strips every synced
 * department — Veeey has no "disabled account" flag, so removing all permissions
 * IS the revocation.
 */
export function reconcileDepartments(current: readonly string[], desired: readonly string[]): ReconcilePlan {
  const owned = new Set<string>(SYNCED_DEPARTMENTS);
  const cur = new Set(current.filter((d) => owned.has(d)));
  const want = new Set(desired.filter((d) => owned.has(d)));
  return {
    add: SYNCED_DEPARTMENTS.filter((d) => want.has(d) && !cur.has(d)),
    remove: SYNCED_DEPARTMENTS.filter((d) => cur.has(d) && !want.has(d)),
  };
}

export type StaffRecord = {
  email: string;
  name: string;
  username: string | null;
  phone: string | null;
  active: boolean;
  teams: string[];
};

/** Normalise one inbound record; null = unusable (no email is not a person we can match). */
export function parseStaffRecord(raw: unknown): StaffRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const email = typeof o.email === 'string' ? o.email.trim().toLowerCase() : '';
  if (!email || !email.includes('@')) return null;
  const name = typeof o.name === 'string' && o.name.trim() ? o.name.trim() : email;
  return {
    email,
    name,
    username: typeof o.username === 'string' && o.username.trim() ? o.username.trim() : null,
    phone: typeof o.phone === 'string' && o.phone.trim() ? o.phone.trim() : null,
    // Anything but an explicit `true` is treated as inactive: the safe direction
    // for a field that governs whether someone keeps admin access.
    active: o.active === true,
    teams: Array.isArray(o.teams) ? o.teams.filter((t): t is string => typeof t === 'string') : [],
  };
}
