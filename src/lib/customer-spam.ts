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

export type SpamReason =
  | 'disposable-email'
  | 'spam-email-domain'
  | 'link-in-name'
  | 'cyrillic-name'
  | 'no-name-no-orders'
  | 'stale-unverified'
  | 'signup-burst';

// Common disposable-email providers (throwaway inboxes used by bots).
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.info', 'sharklasers.com',
  '10minutemail.com', '10minutemail.net', 'tempmail.com', 'temp-mail.org', 'temp-mail.io',
  'yopmail.com', 'trashmail.com', 'getnada.com', 'dispostable.com', 'maildrop.cc',
  'fakeinbox.com', 'mohmal.com', 'emailondeck.com', 'mintemail.com', 'throwawaymail.com',
  'mailnesia.com', 'tempinbox.com', 'spamgourmet.com', 'mytemp.email',
]);

// Mailbox providers behind the Russian/CIS signup floods the owner reported
// (2026-07-22). Veeey sells and ships inside Egypt only, so a registration from
// one of these is a bot, not a shopper who happens to live abroad.
const SPAM_EMAIL_DOMAINS = new Set([
  'mail.ru', 'bk.ru', 'list.ru', 'inbox.ru', 'internet.ru', 'xmail.ru', 'pochta.ru',
  'ya.ru', 'yandex.ru', 'yandex.com', 'yandex.by', 'yandex.kz',
  'rambler.ru', 'lenta.ru', 'autorambler.ru', 'myrambler.ru', 'ro.ru',
]);

// Top-level domains that are effectively free to register and dominate junk
// signups. `.ru`/`.su` are here for the same reason as the providers above.
const SPAM_TLDS = new Set([
  'ru', 'su', 'xyz', 'top', 'click', 'loan', 'work', 'party',
  'gq', 'cf', 'tk', 'ml', 'cyou', 'sbs', 'icu', 'bond',
]);

// TLDs worth recognising when they appear INSIDE a name field — the classic
// SEO-spam registration ("Buy cheap pills bestpills.top"). Wider than SPAM_TLDS
// because here the giveaway is that a name contains a domain at all.
const LINK_TLDS = 'ru|su|com|net|org|info|biz|xyz|top|online|site|shop|club|store|website|space|fun|icu|cyou|bond|sbs|link|pro|live|cc|io';
const LINK_RE = new RegExp(String.raw`(https?://|www\.|\[url|<a\s|\b[a-z0-9][a-z0-9-]*\.(?:${LINK_TLDS})\b)`, 'i');
const CYRILLIC_RE = /[Ѐ-ӿ]/;

const STALE_UNVERIFIED_DAYS = 90; // unverified + zero orders for this long → suspicious
const BURST_WINDOW_MS = 3_600_000; // 1 hour
const BURST_MIN_SIGNUPS = 10; // this many signups inside one window → bot burst

/** Reasons strong enough to justify deletion rather than review. The other
 *  reasons describe *quiet* accounts (no name, never verified, joined in a
 *  busy hour) — true of plenty of real imported customers — so they only ever
 *  flag. See `isPurgeable`. */
export const STRONG_REASONS: readonly SpamReason[] = ['disposable-email', 'spam-email-domain', 'link-in-name', 'cyrillic-name'];

const domainOf = (email: string | null | undefined): string => (email ?? '').toLowerCase().trim().split('@')[1] ?? '';

export const isDisposableEmail = (email: string | null | undefined): boolean => {
  const domain = domainOf(email);
  return !!domain && DISPOSABLE_DOMAINS.has(domain);
};

/** Junk-farm mailbox: a known CIS provider, or any address on a throwaway TLD. */
export const isSpamEmailDomain = (email: string | null | undefined): boolean => {
  const domain = domainOf(email);
  if (!domain) return false;
  if (SPAM_EMAIL_DOMAINS.has(domain)) return true;
  return SPAM_TLDS.has(domain.split('.').pop() ?? '');
};

/** A URL, bare domain or BBCode/HTML link smuggled into a name field. */
export const hasLinkInName = (...parts: (string | null | undefined)[]): boolean =>
  parts.some((p) => !!p && LINK_RE.test(p));

/** Cyrillic in a name. The store serves Arabic and English only, so this is a
 *  bot signature rather than a language preference we support. */
export const hasCyrillicName = (...parts: (string | null | undefined)[]): boolean =>
  parts.some((p) => !!p && CYRILLIC_RE.test(p));

/** Name fields worth scanning: skip any that is just a copy of the email
 *  address (imports and OTP signups fall back to it), so "ali@gmail.com" as a
 *  display name isn't mistaken for a smuggled link. */
const nameParts = (c: SpamCandidate): (string | null)[] => {
  const email = (c.email ?? '').toLowerCase().trim();
  return [c.name, c.firstName, c.lastName].map((p) => (p && p.toLowerCase().trim() === email ? null : p));
};

/**
 * May this account be deleted outright? Every condition must hold: a strong
 * signal, nothing ever bought, and no verified contact. That combination has no
 * business value to lose — anything weaker stays FLAGGED for a human.
 */
export function isPurgeable(candidate: SpamCandidate, reasons: SpamReason[]): boolean {
  if (candidate.ordersCount > 0) return false;
  if (candidate.emailVerified || candidate.phoneVerified) return false;
  return reasons.some((r) => STRONG_REASONS.includes(r));
}

/** The identities of accounts a human deleted as junk (`DeletedSpamAccount`). */
export type Tombstones = { wpIds: Set<number>; emails: Set<string> };

/**
 * Must this WordPress account be left out of the import? Both customer
 * importers are idempotent on legacyWpId/email, so every deleted spam signup
 * would return on the next hourly run without this check. Matching on EITHER
 * key is deliberate: a spammer who re-registers the same address gets a new WP
 * id, and a recycled id must not resurrect the old address.
 */
export const isTombstoned = (t: Tombstones, wpUserId: number | null | undefined, email: string | null | undefined): boolean =>
  (wpUserId != null && t.wpIds.has(wpUserId)) || (!!email && t.emails.has(email.trim().toLowerCase()));

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
    if (isSpamEmailDomain(c.email)) add(c.id, 'spam-email-domain');
    const names = nameParts(c);
    if (hasLinkInName(...names)) add(c.id, 'link-in-name');
    if (hasCyrillicName(...names)) add(c.id, 'cyrillic-name');
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
