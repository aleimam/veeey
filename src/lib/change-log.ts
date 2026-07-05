/**
 * Field-level change log (owner batch #6) — pure diff engine. The Prisma client
 * extension (src/lib/prisma.ts) intercepts writes on TRACKED_MODELS, diffs the
 * row before/after with `diffRecords`, and stores the result in AuditLog
 * (action `change.update` / `change.create` / `change.delete`, dataJson
 * `{ changes: [...] }`). Quantities and balances that already have their own
 * ledger (MovementLedger, LoyaltyTransaction) are skipped to keep the log
 * meaningful. No Prisma imports here so the rules stay unit-testable.
 */

export type FieldChange = { field: string; from: string | number | boolean | null; to: string | number | boolean | null };

/** Business entities whose writes are worth a history entry. High-churn plumbing
 *  (reservations, analytics, notifications, carts, outbox…) stays out. */
export const TRACKED_MODELS = new Set([
  'User', 'Role', 'Customer', 'Address', 'Tier', 'TierProductRule',
  'SystemPaymentMethod', 'OrderStatusConfig', 'Coupon', 'Gift',
  'Brand', 'Category', 'Tag', 'Attribute', 'AttributeValue', 'Product', 'Collection',
  'Location', 'Lot', 'ShippingZone', 'ShippingArea', 'ShippingTypeConfig',
  'Order', 'OrderItem', 'SpecialOrder', 'Review', 'Return',
  'Quiz', 'Game', 'CmsPage', 'BlogPost', 'Redirect',
  'NotificationTemplate', 'Setting', 'SocialLink', 'HomeTestimonial', 'HomeTrustBadge',
  'PageLayout', 'Theme', 'IntegrationClient',
]);

/** Models whose creates are routine volume (checkout lines, checkout addresses,
 *  stock intake) — their creation is recorded elsewhere, only edits are logged. */
export const CREATE_SKIP_MODELS = new Set(['OrderItem', 'Address', 'Lot']);

const GLOBAL_SKIP = new Set(['updatedAt', 'createdAt', 'syncedAt']);
const MODEL_SKIP: Record<string, readonly string[]> = {
  Lot: ['qtyReserved', 'qtyOnHand'], // MovementLedger is the stock ledger
  Customer: ['pointsBalance', 'lifetimeSpendPiastres'], // LoyaltyTransaction / orders are the ledger
  Product: ['ratingAvg', 'ratingCount'], // derived from reviews
};

const MAX_VALUE_LEN = 400;

function skippedFields(model: string): Set<string> {
  return new Set([...GLOBAL_SKIP, ...(MODEL_SKIP[model] ?? [])]);
}

/** Flatten a DB value to a JSON-storable, display-friendly primitive. */
export function normalizeValue(v: unknown): string | number | boolean | null {
  if (v == null) return null;
  if (typeof v === 'boolean' || typeof v === 'number') return v;
  if (typeof v === 'bigint') return v.toString();
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return v.length > MAX_VALUE_LEN ? `${v.slice(0, MAX_VALUE_LEN)}…` : v;
  try {
    const s = JSON.stringify(v);
    return s.length > MAX_VALUE_LEN ? `${s.slice(0, MAX_VALUE_LEN)}…` : s;
  } catch {
    return String(v);
  }
}

/**
 * Field diff between the row before and after a write. Iterates the BEFORE
 * row's keys (a plain scalar row from findUnique), so relation objects that a
 * caller's `include` puts on the result never show up as changes.
 */
export function diffRecords(
  model: string,
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): FieldChange[] {
  if (!before || !after) return [];
  const skip = skippedFields(model);
  const changes: FieldChange[] = [];
  for (const key of Object.keys(before)) {
    if (skip.has(key)) continue;
    if (!(key in after)) continue; // result was narrowed by `select`
    const from = normalizeValue(before[key]);
    const to = normalizeValue(after[key]);
    if (from !== to) changes.push({ field: key, from, to });
  }
  return changes;
}

/** Truncated scalar snapshot of a row (stored when an entity is deleted). */
export function snapshotRecord(model: string, row: Record<string, unknown>): Record<string, string | number | boolean | null> {
  const skip = skippedFields(model);
  const out: Record<string, string | number | boolean | null> = {};
  for (const key of Object.keys(row)) {
    if (skip.has(key)) continue;
    const v = row[key];
    if (v != null && typeof v === 'object' && !(v instanceof Date)) continue; // relations / heavy json
    out[key] = normalizeValue(v);
  }
  return out;
}

/** Best-effort entity id — most models use `id`, Setting uses `key`. */
export function entityIdOf(row: unknown): string | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  if (typeof r.id === 'string') return r.id;
  if (typeof r.key === 'string') return r.key;
  return null;
}
