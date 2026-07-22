/**
 * Configuration export / import — the store's hand-tuned settings, as a file.
 *
 * WHY THIS EXISTS. Almost none of Veeey's configuration lives in code. Tiers,
 * the benefits matrix, the order Status Matrix, shipping zones and governorates,
 * departments and their permissions, feature flags, navigation, the homepage
 * layout, theme tokens, branding, return and spillage reasons, notification
 * templates, search synonyms and rules — all of it is rows in the database,
 * tuned by hand over months. A `git push` carries none of it.
 *
 * So any move between stores (wipe-and-reload, or the eventual veeey.net →
 * veeey.com cutover) otherwise means re-doing that work by hand, which is where
 * a cutover quietly goes wrong: nobody notices the one shipping zone or the one
 * status permission that didn't get re-entered.
 *
 * WHAT IT DELIBERATELY EXCLUDES.
 * - **Secrets.** SMTP passwords, SMS/payment/AI keys, OAuth tokens. An export
 *   file gets copied, emailed and committed; it must never be a credential leak.
 *   Redaction is by PREFIX MATCH ON A DENY-LIST, and unknown `Setting` keys are
 *   exported — so a new secret key added later would leak. `SECRET_KEY_HINTS`
 *   catches anything that merely looks like a credential as a second net.
 * - **Business data.** Products, customers, orders, lots, reviews. Those come
 *   from the catalog sync, not from here.
 * - **Staff membership.** Departments are configuration; who is in them is data,
 *   rebuilt by the YeldnIN staff sync.
 */

export type ConfigTable = {
  /** Prisma model accessor, e.g. 'shippingZone'. */
  model: string;
  /**
   * Column used to match an existing row on import. It MUST be `@unique` or
   * `@id` — Prisma's `update({ where })` rejects anything else, and a wrong
   * guess makes rows silently skip. Verified against schema.prisma; several of
   * the obvious guesses (`tier.code`, `searchRule.term`) do not exist.
   */
  key: string[];
  /**
   * Columns never carried across. `id` is dropped ONLY where a natural key
   * exists; where none does, the id is kept and used as the key, so a reload is
   * an exact restore and a repeated import stays idempotent.
   */
  drop?: string[];
  /** Many-to-many relations to re-link on import, matched by the target's field. */
  connect?: { field: string; on: string }[];
  label: string;
};

/**
 * `Setting` keys whose VALUES are credentials. Prefix match.
 *
 * Keep this in step with `provider-config.ts` — every provider added there needs
 * its prefix here, or the next export quietly contains its key.
 */
export const SECRET_SETTING_PREFIXES = [
  'smtp.', 'sms.', 'whatsapp.', 'opay.', 'kashier.', 'aramex.', 'smsa.', 'ai.',
  'google.', 'gsc.', 'recaptcha.', 'trustpilot.secret', 'backup.',
] as const;

/** Second net: anything that merely LOOKS like a credential, whatever its prefix. */
export const SECRET_KEY_HINTS = ['secret', 'password', 'passwd', 'token', 'apikey', 'api_key', 'privatekey', 'credential'] as const;

/**
 * Keys the hints would catch but which are plainly configuration.
 *
 * `theme.tokens` is the design system — every colour, font and radius the store
 * uses. Losing it to the word "token" would silently strip the storefront's
 * entire appearance on import, and the redaction notice would look routine.
 *
 * EXACT match only, and the deny-list stays deliberately broad: an unrecognised
 * key is redacted (loud, visible in the report, easy to re-enter) rather than
 * exported (silent, and a credential leak). Add here only after checking the
 * value really is not a secret.
 */
export const PUBLIC_SETTING_KEYS = new Set<string>(['theme.tokens']);

export function isSecretSettingKey(key: string): boolean {
  const k = key.toLowerCase();
  if (PUBLIC_SETTING_KEYS.has(key) || PUBLIC_SETTING_KEYS.has(k)) return false;
  if (SECRET_SETTING_PREFIXES.some((p) => k.startsWith(p))) return true;
  return SECRET_KEY_HINTS.some((h) => k.includes(h));
}

/**
 * The manifest. Order matters on import: a table is written after anything it
 * references (zones before their areas, attributes before their values).
 */
export const CONFIG_TABLES: ConfigTable[] = [
  { model: 'setting', key: ['key'], label: 'Settings (flags, tiers, nav, homepage, theme, branding, SEO)' },
  { model: 'orderStatusConfig', key: ['code'], drop: ['id'], label: 'Order statuses + Status Matrix' },
  { model: 'systemPaymentMethod', key: ['code'], drop: ['id'], label: 'Payment methods' },
  // A department with no permissions grants nothing. The relation is NOT
  // returned by a plain findMany, so it has to be asked for and re-linked, or
  // the import silently produces empty departments that look correct.
  { model: 'department', key: ['key'], drop: ['id'], connect: [{ field: 'permissions', on: 'key' }], label: 'Departments + permissions' },
  { model: 'tier', key: ['key'], drop: ['id'], label: 'Loyalty tiers' },
  // `key` is nullable here — manual benefits have none — so it cannot identify a
  // row. Keep the id.
  { model: 'tierBenefit', key: ['id'], connect: [{ field: 'tiers', on: 'key' }], label: 'Tier benefits matrix' },
  { model: 'shippingZone', key: ['id'], label: 'Shipping zones' },
  { model: 'shippingArea', key: ['id'], label: 'Shipping sub-areas (governorates)' },
  { model: 'shippingTypeConfig', key: ['type'], drop: ['id'], label: 'Shipping types' },
  { model: 'returnReason', key: ['id'], label: 'Return reasons' },
  { model: 'spillageReason', key: ['code'], drop: ['id'], label: 'Spillage / damage reasons' },
  // Unique is composite (key, channel, locale); Prisma's update() wants a single
  // unique selector, so the id is simpler and equally correct.
  { model: 'notificationTemplate', key: ['id'], label: 'Notification templates' },
  { model: 'searchSynonym', key: ['normalized'], drop: ['id'], label: 'Search synonyms' },
  { model: 'searchRule', key: ['query'], drop: ['id'], label: 'Search rules (zero-result fixes)' },
  { model: 'socialLink', key: ['id'], label: 'Social links' },
  { model: 'homeTestimonial', key: ['id'], label: 'Home testimonials' },
  { model: 'homeTrustBadge', key: ['id'], label: 'Home trust badges' },
  { model: 'redirect', key: ['fromPath'], drop: ['id'], label: 'Redirects' },
  { model: 'giftRule', key: ['id'], label: 'Gift rules' },
];

export type ExportFile = {
  version: 1;
  exportedAt: string;
  sourceStore: string;
  tables: Record<string, Record<string, unknown>[]>;
  redactedSettings: string[];
  counts: Record<string, number>;
};

/** Strip dropped columns; leave everything else verbatim. */
export function stripRow(row: Record<string, unknown>, drop: string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (drop.includes(k)) continue;
    if (k === 'createdAt' || k === 'updatedAt') continue; // provenance of the row, not configuration
    out[k] = typeof v === 'bigint' ? v.toString() : v;
  }
  return out;
}

/** The natural-key `where` for an upsert. */
export function keyOf(row: Record<string, unknown>, key: string[]): Record<string, unknown> {
  return Object.fromEntries(key.map((k) => [k, row[k]]));
}

/** Human-readable summary of what an export/import touched. */
export function summarize(counts: Record<string, number>): string {
  const rows = Object.entries(counts).filter(([, n]) => n > 0);
  const total = rows.reduce((n, [, v]) => n + v, 0);
  return `${total} row(s) across ${rows.length} table(s)`;
}
