/**
 * Order lifecycle (FR-ORD-01) — editable status engine (STAT).
 *
 * Three layers:
 *  • System statuses — fixed 8 codes below; behavior (icon, customer mapping,
 *    effects, transitions, aliases) is editable via `OrderStatusConfig`.
 *  • Customer-facing — 7 codes (EDIT is invisible → the customer keeps the
 *    previous status; stored on `Order.customerStatus`).
 *  • Legacy — raw WooCommerce / Egypt Vitamins values mapped in via aliases.
 *
 * This module holds the constant codes, the seeded DEFAULT config, and pure
 * helpers that operate on a status-config map. The DB-backed cache + CRUD live
 * in `order-status-service.ts`.
 */

export const ORDER_STATUSES = ['AWAITING_PAYMENT', 'PENDING', 'EDIT', 'HOLD', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED', 'RETURNED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const CUSTOMER_STATUSES = ['PENDING', 'HOLD', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED', 'RETURNED'] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

/**
 * Statuses at which the goods have physically left the building. Used by the
 * cancel-restock rule: cancelling BEFORE this point restores stock (goods are
 * still on the shelf); cancelling at/after it does not — the units come back
 * only through a Return. Keyed off the order's CURRENT status, so an unship
 * (Shipped → Confirmed) makes the order "unshipped" again (owner decision A).
 */
export const SHIPPED_STATUSES: readonly string[] = ['SHIPPED', 'DELIVERED'];

/** Should a cancellation from `fromStatus` put stock back? Only if unshipped. PURE. */
export function restockOnCancel(fromStatus: string): boolean {
  return !SHIPPED_STATUSES.includes(fromStatus);
}

/**
 * Open statuses at which staff may still edit an order's contents and money
 * (add/remove items, change line prices, override the shipping fee, add a manual
 * discount). Once an order is Shipped/Delivered/Cancelled/Refunded it's locked —
 * the owner reopens it (moves it back to an open status) to edit, then re-advances
 * it. AWAITING_PAYMENT is excluded: nothing is owed/held until the customer pays.
 */
export const EDITABLE_STATUSES: readonly string[] = ['PENDING', 'EDIT', 'HOLD', 'CONFIRMED'];

/** May an order in `status` be edited (items/prices/discount/shipping)? PURE. */
export function isOrderEditable(status: string): boolean {
  return EDITABLE_STATUSES.includes(status);
}

//  none               → never touch stock
//  restock            → always restore to sellable (RETURNED: goods came back, inspected)
//  restock_if_unshipped → restore ONLY when leaving an unshipped status (CANCELLED)
export type StockEffect = 'none' | 'restock' | 'restock_if_unshipped';

/** Resolve a stock effect for a specific transition. PURE — the single place the
 *  cancel-vs-return distinction lives, so it can be unit-tested without a DB. */
export function stockEffectApplies(effect: StockEffect, fromStatus: string): boolean {
  if (effect === 'restock') return true;
  if (effect === 'restock_if_unshipped') return restockOnCancel(fromStatus);
  return false;
}
export type PaymentEffect = 'none' | 'paid' | 'refunded';
export type RevenueEffect = 'none' | 'realize' | 'reverse';
export type LoyaltyEffect = 'none' | 'credit' | 'reverse';
export type NotifyAudience = 'none' | 'customer' | 'staff' | 'both';

export type StatusConfig = {
  code: OrderStatus;
  labelEn: string;
  labelAr: string;
  customerCode: CustomerStatus | null; // null = invisible (keeps previous)
  icon: string;
  stockEffect: StockEffect;
  paymentEffect: PaymentEffect;
  revenueEffect: RevenueEffect;
  loyaltyEffect: LoyaltyEffect;
  notifyAudience: NotifyAudience;
  notifyTemplateKey: string | null;
  // Who may move an order INTO this status (RBAC permission key); null → the
  // baseline `orders.write`. Lets the owner say e.g. "only Sales can Confirm".
  advancePermission: string | null;
  // Offer this transition as a one-click icon in the admin orders list.
  fastAction: boolean;
  allowedNext: OrderStatus[];
  sourceAliases: string[];
  sortOrder: number;
  active: boolean;
  isDefault: boolean;
};

/** The baseline permission every transition needs when a status names none. */
export const DEFAULT_ADVANCE_PERMISSION = 'orders.write';

/** Seeded defaults (owner-signed-off). All fields editable in admin afterwards. */
export const DEFAULT_STATUS_CONFIG: StatusConfig[] = [
  {
    // Checkout backlog P0: an online-payment order between placement and the
    // gateway webhook. No notifications, hidden from the default admin list and
    // excluded from sales analytics; PAID moves it to PENDING, the sweep cancels
    // (and restocks — it's never "shipped") an abandoned one. The customer sees
    // plain "Pending" — the awaiting nuance lives on the confirmation page.
    code: 'AWAITING_PAYMENT', labelEn: 'Awaiting payment', labelAr: 'بانتظار الدفع', customerCode: 'PENDING', icon: 'credit-card',
    stockEffect: 'none', paymentEffect: 'none', revenueEffect: 'none', loyaltyEffect: 'none', notifyAudience: 'none', notifyTemplateKey: null,
    advancePermission: null, fastAction: false,
    allowedNext: ['PENDING', 'CANCELLED'],
    sourceAliases: ['awaiting-payment', 'awaiting_payment'],
    sortOrder: 0, active: true, isDefault: false,
  },
  {
    code: 'PENDING', labelEn: 'Pending', labelAr: 'قيد الانتظار', customerCode: 'PENDING', icon: 'clock',
    stockEffect: 'none', paymentEffect: 'none', revenueEffect: 'none', loyaltyEffect: 'none', notifyAudience: 'none', notifyTemplateKey: null,
    advancePermission: null, fastAction: false,
    allowedNext: ['CONFIRMED', 'HOLD', 'EDIT', 'CANCELLED'],
    sourceAliases: ['pending', 'draft', 'pending confirmation', 'pending-confirmation', 'pending_confirmation', 'checkout-draft', 'wc-pending', 'wc-checkout-draft'],
    sortOrder: 1, active: true, isDefault: true,
  },
  {
    code: 'EDIT', labelEn: 'Edit', labelAr: 'تعديل', customerCode: null, icon: 'pencil',
    stockEffect: 'none', paymentEffect: 'none', revenueEffect: 'none', loyaltyEffect: 'none', notifyAudience: 'none', notifyTemplateKey: null,
    advancePermission: null, fastAction: false,
    allowedNext: ['PENDING', 'HOLD', 'CONFIRMED', 'CANCELLED'],
    sourceAliases: ['edit'],
    sortOrder: 2, active: true, isDefault: false,
  },
  {
    code: 'HOLD', labelEn: 'Hold', labelAr: 'معلّق', customerCode: 'HOLD', icon: 'pause-circle',
    stockEffect: 'none', paymentEffect: 'none', revenueEffect: 'none', loyaltyEffect: 'none', notifyAudience: 'none', notifyTemplateKey: null,
    advancePermission: null, fastAction: false,
    allowedNext: ['CONFIRMED', 'EDIT', 'CANCELLED'],
    sourceAliases: ['hold', 'on-hold', 'on hold', 'wc-on-hold'],
    sortOrder: 3, active: true, isDefault: false,
  },
  {
    // Owner rule: only Sales confirm orders. `orders.write` is the Pharmacist
    // (Sales) grant; Operations (orders.fulfill only) can't.
    code: 'CONFIRMED', labelEn: 'Confirmed', labelAr: 'مؤكد', customerCode: 'CONFIRMED', icon: 'badge-check',
    stockEffect: 'none', paymentEffect: 'none', revenueEffect: 'none', loyaltyEffect: 'none', notifyAudience: 'customer', notifyTemplateKey: 'order.confirmed',
    advancePermission: 'orders.write', fastAction: true,
    allowedNext: ['SHIPPED', 'HOLD', 'EDIT', 'CANCELLED'],
    sourceAliases: ['processing', 'confirmed', 'wc-processing'],
    sortOrder: 4, active: true, isDefault: false,
  },
  {
    code: 'SHIPPED', labelEn: 'Shipped', labelAr: 'تم الشحن', customerCode: 'SHIPPED', icon: 'truck',
    stockEffect: 'none', paymentEffect: 'none', revenueEffect: 'none', loyaltyEffect: 'none', notifyAudience: 'customer', notifyTemplateKey: 'order.shipped',
    advancePermission: 'orders.fulfill', fastAction: true,
    allowedNext: ['DELIVERED', 'CONFIRMED', 'CANCELLED', 'REFUNDED'],
    sourceAliases: ['shipped', 'wc-shipped'],
    sortOrder: 5, active: true, isDefault: false,
  },
  {
    code: 'DELIVERED', labelEn: 'Delivered', labelAr: 'تم التسليم', customerCode: 'DELIVERED', icon: 'package-check',
    stockEffect: 'none', paymentEffect: 'paid', revenueEffect: 'realize', loyaltyEffect: 'credit', notifyAudience: 'customer', notifyTemplateKey: 'order.delivered',
    advancePermission: 'orders.fulfill', fastAction: true,
    // CONFIRMED = the reopen path: a Delivered order can be moved back to an open
    // status, edited (prices/discount/items), then re-delivered (owner rule).
    allowedNext: ['REFUNDED', 'CANCELLED', 'RETURNED', 'CONFIRMED'],
    sourceAliases: ['delivered', 'completed', 'cash delivered', 'card delivered', 'cash-delivered', 'card-delivered', 'cash_delivered', 'card_delivered', 'wc-completed'],
    sortOrder: 6, active: true, isDefault: false,
  },
  {
    code: 'CANCELLED', labelEn: 'Cancelled', labelAr: 'ملغى', customerCode: 'CANCELLED', icon: 'x-circle',
    // Restock ONLY if the order hadn't shipped — goods still on the shelf. A
    // shipped-then-cancelled order restocks later via a Return, not here.
    stockEffect: 'restock_if_unshipped', paymentEffect: 'none', revenueEffect: 'reverse', loyaltyEffect: 'reverse', notifyAudience: 'customer', notifyTemplateKey: 'order.cancelled',
    advancePermission: 'orders.write', fastAction: false,
    allowedNext: ['RETURNED'],
    sourceAliases: ['cancelled', 'canceled', 'failed', 'wc-cancelled', 'wc-failed'],
    sortOrder: 7, active: true, isDefault: false,
  },
  {
    code: 'REFUNDED', labelEn: 'Refunded', labelAr: 'مُسترد', customerCode: 'REFUNDED', icon: 'rotate-ccw',
    // A refund moves MONEY, never stock (owner rule: stock returns on a Return
    // only). Recording the money refund is now decoupled from status anyway.
    stockEffect: 'none', paymentEffect: 'refunded', revenueEffect: 'reverse', loyaltyEffect: 'reverse', notifyAudience: 'customer', notifyTemplateKey: 'order.refunded',
    advancePermission: 'finance.manage', fastAction: false,
    allowedNext: ['RETURNED'],
    sourceAliases: ['refunded', 'wc-refunded', 'partially-refunded'],
    sortOrder: 8, active: true, isDefault: false,
  },
  {
    code: 'RETURNED', labelEn: 'Returned', labelAr: 'مُرتجع', customerCode: 'RETURNED', icon: 'undo-2',
    // Goods physically came back and PASSED inspection — marking Returned is the
    // sign-off, so stock goes straight to sellable (owner decision B-i).
    stockEffect: 'restock', paymentEffect: 'none', revenueEffect: 'reverse', loyaltyEffect: 'reverse', notifyAudience: 'customer', notifyTemplateKey: 'order.returned',
    advancePermission: 'returns.manage', fastAction: false,
    allowedNext: [],
    sourceAliases: ['returned', 'wc-returned'],
    sortOrder: 9, active: true, isDefault: false,
  },
];

export type StatusMap = Map<string, StatusConfig>;
export const toStatusMap = (rows: StatusConfig[]): StatusMap => new Map(rows.map((r) => [r.code, r]));
export const DEFAULT_STATUS_MAP: StatusMap = toStatusMap(DEFAULT_STATUS_CONFIG);

/** Is `to` reachable from `from` per the config? (Pure.) */
export function canTransitionWith(map: StatusMap, from: string, to: string): boolean {
  if (from === to) return false;
  return map.get(from)?.allowedNext.includes(to as OrderStatus) ?? false;
}

/** RBAC key required to move an order INTO `to` (falls back to the baseline). Pure. */
export function advancePermissionFor(map: StatusMap, to: string): string {
  const p = map.get(to)?.advancePermission;
  return p && p.trim() ? p.trim() : DEFAULT_ADVANCE_PERMISSION;
}

/**
 * One-click transitions to offer from `from`, given the acting user's grants:
 * the reachable next statuses that are flagged `fastAction` AND the user is
 * allowed to advance into. Pure — the orders list renders exactly these icons.
 */
export function fastActionsFrom(
  map: StatusMap,
  from: string,
  granted: readonly string[] | undefined,
): StatusConfig[] {
  const has = (key: string) => (granted ?? []).includes(key);
  const next = map.get(from)?.allowedNext ?? [];
  return next
    .map((code) => map.get(code))
    .filter((c): c is StatusConfig => !!c && c.active && c.fastAction && has(advancePermissionFor(map, c.code)));
}

/** The customer-facing code for a system status (null = keep previous). */
export function customerStatusOf(map: StatusMap, code: string): CustomerStatus | null {
  return map.get(code)?.customerCode ?? null;
}

/** Map a raw legacy/import status string to a system code via aliases. */
export function resolveStatusAlias(map: StatusMap, raw: string): OrderStatus | null {
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  for (const cfg of map.values()) {
    if (cfg.code.toLowerCase() === key) return cfg.code;
    if (cfg.sourceAliases.some((a) => a.toLowerCase() === key)) return cfg.code;
  }
  return null;
}

/** Statuses that realize revenue (config-driven). */
export function isRevenueStatus(map: StatusMap, code: string): boolean {
  return map.get(code)?.revenueEffect === 'realize';
}
