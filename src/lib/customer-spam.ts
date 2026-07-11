/**
 * Spam-account heuristics (V5 F31). Pure module — the service feeds it minimal
 * customer rows; it returns per-customer suspicion reasons. Flagging is
 * reversible (status FLAGGED, reviewed by staff) so heuristics favour recall.
 */
export type SpamCandidate = {
  id: string;
  email: string | null;
  name: string | null; // login display name (User.name)
  firstName: string | null;
  lastName: string | null;
  createdAt: Date;
  ordersCount: number;
  emailVerified: Date | null;
  phoneVerified: Date | null;
};

export type SpamReason = 'disposable-email' | 'no-name-no-orders' | 'stale-unverified' | 'signup-burst';

// Common disposable-email providers (throwaway inboxes used by bots).
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.info', 'sharklasers.com',
  '10minutemail.com', '10minutemail.net', 'tempmail.com', 'temp-mail.org', 'temp-mail.io',
  'yopmail.com', 'trashmail.com', 'getnada.com', 'dispostable.com', 'maildrop.cc',
  'fakeinbox.com', 'mohmal.com', 'emailondeck.com', 'mintemail.com', 'throwawaymail.com',
  'mailnesia.com', 'tempinbox.com', 'spamgourmet.com', 'mytemp.email',
]);

const STALE_UNVERIFIED_DAYS = 90; // unverified + zero orders for this long → suspicious
const BURST_WINDOW_MS = 3_600_000; // 1 hour
const BURST_MIN_SIGNUPS = 10; // this many signups inside one window → bot burst

export const isDisposableEmail = (email: string | null | undefined): boolean => {
  const domain = (email ?? '').toLowerCase().split('@')[1];
  return !!domain && DISPOSABLE_DOMAINS.has(domain);
};

/** Classify every candidate; only customers with ≥1 reason appear in the map. */
export function findSuspicious(candidates: SpamCandidate[], now = Date.now()): Map<string, SpamReason[]> {
  const out = new Map<string, SpamReason[]>();
  const add = (id: string, reason: SpamReason) => {
    const list = out.get(id) ?? [];
    if (!list.includes(reason)) list.push(reason);
    out.set(id, list);
  };

  // Signup bursts: bucket join times by hour; big buckets are bot runs.
  const buckets = new Map<number, string[]>();
  for (const c of candidates) {
    const bucket = Math.floor(c.createdAt.getTime() / BURST_WINDOW_MS);
    buckets.set(bucket, [...(buckets.get(bucket) ?? []), c.id]);
  }
  for (const ids of buckets.values()) {
    if (ids.length >= BURST_MIN_SIGNUPS) ids.forEach((id) => add(id, 'signup-burst'));
  }

  for (const c of candidates) {
    if (isDisposableEmail(c.email)) add(c.id, 'disposable-email');
    const unverified = !c.emailVerified && !c.phoneVerified;
    const hasName = !!(c.firstName?.trim() || c.lastName?.trim() || c.name?.trim());
    // Both name-less rules also require "never bought + never verified" so real
    // (e.g. imported) customers aren't mass-flagged.
    if (!hasName && c.ordersCount === 0 && unverified) add(c.id, 'no-name-no-orders');
    const ageDays = (now - c.createdAt.getTime()) / 86_400_000;
    if (unverified && c.ordersCount === 0 && ageDays >= STALE_UNVERIFIED_DAYS) add(c.id, 'stale-unverified');
  }
  return out;
}
