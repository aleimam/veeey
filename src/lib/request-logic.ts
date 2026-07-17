/**
 * Pure request logic (Requests epic) — ported from YeldnIN's request-logic so
 * the two systems agree on types, the approval gate, and validation. No DB/IO.
 *
 * Veeey-specific trims vs YeldnIN: every Veeey request is scope EGV (Veeey IS
 * Egypt Vitamins), so the scope/XOONX/module-RBAC helpers are dropped; money is
 * piastres (integers), not float EGP.
 */

export const REQUEST_TYPES = ['SPECIAL_ORDER', 'OUT_OF_STOCK', 'RESTOCK', 'OPTIONAL'] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];
export function isRequestType(v: unknown): v is RequestType {
  return typeof v === 'string' && (REQUEST_TYPES as readonly string[]).includes(v);
}

// Approval gate: a request's lines enter the purchasing pool only once APPROVED.
export const REQUEST_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export function isRequestStatus(v: unknown): v is RequestStatus {
  return typeof v === 'string' && (REQUEST_STATUSES as readonly string[]).includes(v);
}

/** A special order is customer-driven, so it needs a customer and allows photos. */
export function requiresCustomer(type: string): boolean {
  return type === 'SPECIAL_ORDER';
}
export function allowsPhotos(type: string): boolean {
  return type === 'SPECIAL_ORDER';
}

/** A request's lines are frozen once it leaves PENDING (approved or rejected). */
export function requestEditable(status: string): boolean {
  return status === 'PENDING';
}

export type RequestLineInput = { productId: string; count: number };

/** Field-keyed validation errors ({} = valid). Mirrors YeldnIN's validateRequest. */
export function validateRequest(input: {
  type?: string;
  customerId?: string | null;
  newCustomerName?: string;
  lines?: RequestLineInput[];
}): Record<string, string> {
  const e: Record<string, string> = {};
  if (!isRequestType(input.type ?? '')) e.type = 'A valid request type is required.';
  if (requiresCustomer(input.type ?? '') && !input.customerId && !input.newCustomerName?.trim()) {
    e.customer = 'A special order needs a customer.';
  }
  const lines = (input.lines ?? []).filter((l) => l.productId && Number.isInteger(l.count) && l.count >= 1);
  if (!lines.length) e.lines = 'Add at least one product line.';
  return e;
}

/**
 * Suggested special-order deposit in PIASTRES: `pct`% of the order's total
 * selling value (Σ count × unit selling price), rounded to whole piastres.
 * Lines without a selling price contribute 0.
 */
export function expectedDepositPiastres(pct: number, lines: { count: number; sellingPricePiastres: number | null }[]): number {
  const total = lines.reduce((sum, l) => sum + (l.count || 0) * (l.sellingPricePiastres ?? 0), 0);
  return Math.round((total * (pct || 0)) / 100);
}

/**
 * Which of an order's (non-lost) lines a purchasing request should cover (Phase B):
 * the pre-ordered lines if any are flagged, otherwise every line. Pure so the
 * "pre-order first, else whole order" rule is unit-testable independent of the DB.
 */
export function pickOrderRequestLines<T extends { preorder: boolean }>(items: T[]): T[] {
  const pre = items.filter((i) => i.preorder);
  return pre.length ? pre : items;
}

/**
 * Map an inventory reorder-suggestion tab to the request type its quick "Request"
 * button should create (A5). Out-of-stock and last-piece (only one left) default
 * to OUT_OF_STOCK; short-stock and running-fast are RESTOCK. The special-orders
 * suggestion tab is aggregated demand with no per-customer context, so its quick
 * request is a purchasing top-up (OUT_OF_STOCK) — a true customer-linked
 * SPECIAL_ORDER request is placed from the order flow, not here.
 */
export function reorderTabToRequestType(tab: string): RequestType {
  switch (tab) {
    case 'short_stock':
    case 'running_fast':
      return 'RESTOCK';
    case 'out_of_stock':
    case 'last_piece':
    case 'special_orders':
    default:
      return 'OUT_OF_STOCK';
  }
}

/**
 * Whether an always-needed product's OPTIONAL request is due for its monthly
 * reset (Phase C): true once `intervalDays` have elapsed since it was created.
 * Pure so the 30-day cadence is unit-testable independent of the DB.
 */
export function optionalRefillDue(createdAt: Date, now: Date, intervalDays = 30): boolean {
  return now.getTime() - createdAt.getTime() >= intervalDays * 86_400_000;
}

/**
 * The human request key REQ<YY><MM><seq3> (e.g. REQ2607014), shared with
 * YeldnIN. `seq` is the 1-based count within the given month. Pure — the caller
 * (service) supplies the current month's next sequence.
 */
export function requestUid(now: Date, seq: number): string {
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `REQ${yy}${mm}${String(seq).padStart(3, '0')}`;
}
