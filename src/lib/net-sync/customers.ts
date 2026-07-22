/**
 * net-sync customers — source reads + importer (ongoing one-way pull WP → veeey.net).
 *
 * PII stays on the box (localhost DB→DB); nothing here is logged in the clear —
 * the CLI reports counts only. Registered WP customers → Veeey User+Customer(+Address).
 * Idempotent on Customer.legacyWpId (= WP user id); matched by lowercased email for
 * first-time links. NEVER writes passwords/roles; never overwrites a non-empty native
 * field. Lifetime spend comes from a read-only WP order-totals snapshot and drives the
 * tier (we do NOT call recomputeLoyaltyStanding — it would reset spend to veeey.net-only
 * orders and wipe the imported history).
 */
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { prisma } from '@/lib/prisma';
import { generateReferralCode } from '@/lib/customer';
import { manualTierActive } from '@/lib/loyalty-standing';
import { isTombstoned, type Tombstones } from '@/lib/customer-spam';
import { planCustomer, spendToPiastres, pickTierId, type RawCustomer, type PlannedCustomer } from './customers-transform';

const PREFIX = process.env.NET_SYNC_WP_PREFIX || 'SFPgx_';
const T = (n: string) => `\`${PREFIX}${n}\``;
type Row = RowDataPacket & Record<string, unknown>;

// Statuses that count toward lifetime spend. Default matches THIS store's custom
// WooCommerce statuses (revenue is almost all `wc-card-delivered` / `wc-delivered`;
// the default `wc-completed` is barely used) — env-overridable so a new status
// doesn't need a code change. Cancelled / on-hold / refunded are excluded.
const SPEND_STATUSES = (process.env.NET_SYNC_SPEND_STATUSES || 'wc-completed,wc-processing,wc-delivered,wc-card-delivered')
  .split(',').map((x) => x.trim()).filter(Boolean);

const s = (v: unknown): string | null => (v == null ? null : String(v));
const chunk = <T>(a: T[], n: number): T[][] => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

export type SpendSnapshot = { lifetime: bigint; windowed: bigint };

/**
 * Accounts a human deleted as junk (`/admin/customers/spam`). This importer is
 * idempotent on legacyWpId/email, so without this list every deleted spam
 * signup would reappear on the next hourly run. Deleting the tombstone row is
 * the undo — the account then imports again like any other.
 */
export async function readTombstones(): Promise<Tombstones> {
  const rows = await prisma.deletedSpamAccount.findMany({ select: { legacyWpId: true, email: true } });
  return {
    wpIds: new Set(rows.map((r) => r.legacyWpId).filter((v): v is number => v != null)),
    emails: new Set(rows.map((r) => r.email).filter((v): v is string => !!v)),
  };
}

/** WP user id → {lifetime, windowed} spend (piastres). Sourced from HPOS
 *  `wc_orders`: `customer_id` IS the WP user id (0 = guest), `total_amount` is
 *  what the customer actually paid. `windowed` bounds to the last `windowDays`
 *  (equals lifetime when windowDays = 0) — the tier qualifies on the window
 *  (Setting `loyalty.tierWindowDays`) while lifetimeSpendPiastres stays true
 *  lifetime. */
export async function readSpendMap(pool: Pool, windowDays: number): Promise<Map<number, SpendSnapshot>> {
  const ph = SPEND_STATUSES.map(() => '?').join(',');
  const [rows] = await pool.query<Row[]>(
    `SELECT customer_id AS uid, SUM(total_amount) AS spend,
            SUM(CASE WHEN date_created_gmt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY) THEN total_amount ELSE 0 END) AS windowed
     FROM ${T('wc_orders')}
     WHERE customer_id > 0 AND status IN (${ph})
     GROUP BY customer_id`,
    [windowDays > 0 ? windowDays : 36500, ...SPEND_STATUSES],
  );
  const m = new Map<number, SpendSnapshot>();
  for (const r of rows) m.set(Number(r.uid), { lifetime: spendToPiastres(Number(r.spend)), windowed: spendToPiastres(Number(r.windowed)) });
  return m;
}

const META_KEYS = [
  'first_name', 'last_name', 'billing_first_name', 'billing_last_name', 'billing_phone',
  'billing_address_1', 'billing_address_2', 'billing_city', 'billing_state',
  'shipping_phone', 'shipping_address_1', 'shipping_address_2', 'shipping_city', 'shipping_state',
];

/** All registered ('customer' role) WP users, pivoted with their profile meta. */
export async function readSourceCustomers(pool: Pool): Promise<RawCustomer[]> {
  const metaPh = META_KEYS.map(() => '?').join(',');
  const pick = (k: string) => `MAX(CASE WHEN m.meta_key='${k}' THEN m.meta_value END)`;
  const out: RawCustomer[] = [];
  let lastId = 0;
  for (;;) {
    const [rows] = await pool.query<Row[]>(
      `SELECT u.ID AS id, u.user_email AS email, u.display_name AS displayName,
              ${pick('first_name')} first_name, ${pick('last_name')} last_name,
              ${pick('billing_first_name')} b_first, ${pick('billing_last_name')} b_last, ${pick('billing_phone')} b_phone,
              ${pick('billing_address_1')} b_a1, ${pick('billing_address_2')} b_a2, ${pick('billing_city')} b_city, ${pick('billing_state')} b_state,
              ${pick('shipping_phone')} s_phone, ${pick('shipping_address_1')} s_a1, ${pick('shipping_address_2')} s_a2, ${pick('shipping_city')} s_city, ${pick('shipping_state')} s_state
       FROM ${T('users')} u
       JOIN ${T('usermeta')} cap ON cap.user_id = u.ID AND cap.meta_key = ? AND cap.meta_value LIKE ?
       LEFT JOIN ${T('usermeta')} m ON m.user_id = u.ID AND m.meta_key IN (${metaPh})
       WHERE u.user_email <> '' AND u.ID > ?
       GROUP BY u.ID ORDER BY u.ID LIMIT 2000`,
      [`${PREFIX}capabilities`, '%"customer"%', ...META_KEYS, lastId],
    );
    if (!rows.length) break;
    for (const r of rows) {
      out.push({
        wpUserId: Number(r.id), email: String(r.email), displayName: s(r.displayName),
        firstName: s(r.first_name), lastName: s(r.last_name), billingFirst: s(r.b_first), billingLast: s(r.b_last),
        billingPhone: s(r.b_phone), billingAddress1: s(r.b_a1), billingAddress2: s(r.b_a2), billingCity: s(r.b_city), billingState: s(r.b_state),
        shippingPhone: s(r.s_phone), shippingAddress1: s(r.s_a1), shippingAddress2: s(r.s_a2), shippingCity: s(r.s_city), shippingState: s(r.s_state),
      });
    }
    lastId = Number(rows[rows.length - 1].id);
    if (rows.length < 2000) break;
  }
  return out;
}

export type CustomerSummary = {
  source: number; created: number; linked: number; updated: number; skipped: number;
  addressesCreated: number; withPhone: number; withSpend: number; errors: { wpUserId: number; detail: string }[];
};

/** Import/refresh registered customers. Efficient: two bulk pre-loads, then write
 *  only when something actually changed (so hourly re-runs mostly no-op). */
export async function importCustomers(pool: Pool, opts: { dryRun: boolean; onProgress?: (n: number, total: number) => void }): Promise<CustomerSummary> {
  const sum: CustomerSummary = { source: 0, created: 0, linked: 0, updated: 0, skipped: 0, addressesCreated: 0, withPhone: 0, withSpend: 0, errors: [] };

  // Tier window (Setting `loyalty.tierWindowDays`, admin-editable): 0 = lifetime.
  const windowSetting = await prisma.setting.findUnique({ where: { key: 'loyalty.tierWindowDays' } });
  const windowDays = Math.max(0, Math.round(Number(windowSetting?.value) || 0));
  const [spendMap, rawList, greenTier, tierRows] = await Promise.all([
    readSpendMap(pool, windowDays),
    readSourceCustomers(pool),
    prisma.tier.findUnique({ where: { key: 'GREEN' }, select: { id: true } }),
    prisma.tier.findMany({ select: { id: true, rank: true, minSpendPiastres: true } }),
  ]);
  const tiers = tierRows.map((t) => ({ id: t.id, rank: t.rank, minSpendPiastres: BigInt(t.minSpendPiastres) }));
  sum.source = rawList.length;

  // Accounts a human deleted as junk must NOT come back on the next hourly run.
  const tombstones = await readTombstones();
  const planned: PlannedCustomer[] = [];
  for (const p of rawList.map(planCustomer)) {
    if (isTombstoned(tombstones, p.wpUserId, p.email)) { sum.skipped++; continue; }
    planned.push(p);
  }

  // Pre-load already-imported customers (by legacyWpId) + any user sharing an email.
  const existingByWp = new Map<number, { custId: string; userId: string; firstName: string | null; lastName: string | null; spend: bigint; tierId: string | null; tierLocked: boolean; email: string | null; userPhone: string | null; userName: string | null }>();
  const nowTs = new Date();
  for (const c of await prisma.customer.findMany({ where: { legacyWpId: { not: null } }, select: { id: true, legacyWpId: true, firstName: true, lastName: true, lifetimeSpendPiastres: true, tierId: true, tierManual: true, tierManualUntil: true, user: { select: { id: true, email: true, phone: true, name: true } } } })) {
    existingByWp.set(c.legacyWpId!, { custId: c.id, userId: c.user.id, firstName: c.firstName, lastName: c.lastName, spend: BigInt(c.lifetimeSpendPiastres), tierId: c.tierId, tierLocked: manualTierActive(c.tierManual, c.tierManualUntil, nowTs), email: c.user.email, userPhone: c.user.phone, userName: c.user.name });
  }
  const emailToUser = new Map<string, { userId: string; phone: string | null; name: string | null; custId: string | null; custWp: number | null }>();
  const needEmails = [...new Set(planned.filter((p) => !existingByWp.has(p.wpUserId)).map((p) => p.email))];
  for (const part of chunk(needEmails, 1000)) {
    for (const u of await prisma.user.findMany({ where: { email: { in: part } }, select: { id: true, email: true, phone: true, name: true, customer: { select: { id: true, legacyWpId: true } } } })) {
      if (u.email) emailToUser.set(u.email.toLowerCase(), { userId: u.id, phone: u.phone, name: u.name, custId: u.customer?.id ?? null, custWp: u.customer?.legacyWpId ?? null });
    }
  }

  let i = 0;
  for (const p of planned) {
    if (p.phone) sum.withPhone++;
    const snap = spendMap.get(p.wpUserId) ?? { lifetime: 0n, windowed: 0n };
    const spend = snap.lifetime;
    if (spend > 0n) sum.withSpend++;
    const tierId = pickTierId(tiers, windowDays > 0 ? snap.windowed : snap.lifetime) ?? greenTier?.id ?? null;
    try {
      const ex = existingByWp.get(p.wpUserId);
      if (ex) {
        // Manual/paid tier lock: the sync keeps its hands off tierId while active.
        const effectiveTierId = ex.tierLocked ? ex.tierId : tierId;
        // UPDATE only when a synced field changed (keeps hourly runs cheap).
        const custChanged = ex.firstName !== p.firstName || ex.lastName !== p.lastName || ex.spend !== spend || ex.tierId !== effectiveTierId;
        const fillName = !ex.userName && p.name ? p.name : null;
        const fillPhone = !ex.userPhone && p.phone ? p.phone : null;
        if (custChanged || fillName || fillPhone) {
          if (!opts.dryRun) {
            if (custChanged) await prisma.customer.update({ where: { id: ex.custId }, data: { firstName: p.firstName, lastName: p.lastName, lifetimeSpendPiastres: spend, tierId: effectiveTierId } });
            if (fillName || fillPhone) await prisma.user.update({ where: { id: ex.userId }, data: { ...(fillName ? { name: fillName } : {}), ...(fillPhone ? { phone: fillPhone } : {}) } });
          }
          sum.updated++;
        } else sum.skipped++;
        continue;
      }

      const hit = emailToUser.get(p.email);
      if (hit) {
        // A user with this email already exists (native or unlinked) — link, never
        // touch credentials/roles; fill blank name/phone only.
        if (hit.custWp && hit.custWp !== p.wpUserId) { sum.skipped++; continue; } // already linked elsewhere
        if (!opts.dryRun) {
          const fill: { name?: string; phone?: string } = {};
          if (!hit.name && p.name) fill.name = p.name;
          if (!hit.phone && p.phone) fill.phone = p.phone;
          if (Object.keys(fill).length) await prisma.user.update({ where: { id: hit.userId }, data: fill });
          if (hit.custId) {
            await prisma.customer.update({ where: { id: hit.custId }, data: { legacyWpId: p.wpUserId, firstName: p.firstName, lastName: p.lastName, lifetimeSpendPiastres: spend, tierId } });
          } else {
            await createCustomer(hit.userId, p, spend, tierId, greenTier?.id ?? null, sum);
          }
        }
        sum.linked++;
        continue;
      }

      // Fresh: create User (no password) + Customer + addresses.
      if (!opts.dryRun) {
        const user = await prisma.user.create({ data: { email: p.email, name: p.name, phone: p.phone }, select: { id: true } });
        await createCustomer(user.id, p, spend, tierId, greenTier?.id ?? null, sum);
      }
      sum.created++;
    } catch (e) {
      sum.errors.push({ wpUserId: p.wpUserId, detail: e instanceof Error ? e.message : String(e) });
    }
    if (++i % 500 === 0) opts.onProgress?.(i, planned.length);
  }
  opts.onProgress?.(planned.length, planned.length);
  return sum;
}

/** Create the Customer profile (+ default wishlist + addresses) for a user. */
async function createCustomer(userId: string, p: PlannedCustomer, spend: bigint, tierId: string | null, greenId: string | null, sum: CustomerSummary) {
  const cust = await prisma.customer.create({
    data: {
      userId,
      legacyWpId: p.wpUserId,
      firstName: p.firstName,
      lastName: p.lastName,
      tierId: tierId ?? greenId,
      lifetimeSpendPiastres: spend,
      marketingConsent: false, // no WP opt-in flag → default OFF (owner decision)
      marketingSmsConsent: false,
      referralCode: await generateReferralCode(),
      wishlistLists: { create: { name: 'My Wishlist', isDefault: true } },
    },
    select: { id: true },
  });
  if (p.addresses.length) {
    await prisma.address.createMany({ data: p.addresses.map((a) => ({ customerId: cust.id, ...a })) });
    sum.addressesCreated += p.addresses.length;
  }
}
