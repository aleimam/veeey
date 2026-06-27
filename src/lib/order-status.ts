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

export const ORDER_STATUSES = ['PENDING', 'EDIT', 'HOLD', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const CUSTOMER_STATUSES = ['PENDING', 'HOLD', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export type StockEffect = 'none' | 'restock';
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
  allowedNext: OrderStatus[];
  sourceAliases: string[];
  sortOrder: number;
  active: boolean;
  isDefault: boolean;
};

/** Seeded defaults (owner-signed-off). All fields editable in admin afterwards. */
export const DEFAULT_STATUS_CONFIG: StatusConfig[] = [
  {
    code: 'PENDING', labelEn: 'Pending', labelAr: 'قيد الانتظار', customerCode: 'PENDING', icon: 'clock',
    stockEffect: 'none', paymentEffect: 'none', revenueEffect: 'none', loyaltyEffect: 'none', notifyAudience: 'none', notifyTemplateKey: null,
    allowedNext: ['CONFIRMED', 'HOLD', 'EDIT', 'CANCELLED'],
    sourceAliases: ['pending', 'draft', 'pending confirmation', 'pending-confirmation', 'pending_confirmation', 'checkout-draft', 'wc-pending', 'wc-checkout-draft'],
    sortOrder: 1, active: true, isDefault: true,
  },
  {
    code: 'EDIT', labelEn: 'Edit', labelAr: 'تعديل', customerCode: null, icon: 'pencil',
    stockEffect: 'none', paymentEffect: 'none', revenueEffect: 'none', loyaltyEffect: 'none', notifyAudience: 'none', notifyTemplateKey: null,
    allowedNext: ['PENDING', 'HOLD', 'CONFIRMED', 'CANCELLED'],
    sourceAliases: ['edit'],
    sortOrder: 2, active: true, isDefault: false,
  },
  {
    code: 'HOLD', labelEn: 'Hold', labelAr: 'معلّق', customerCode: 'HOLD', icon: 'pause-circle',
    stockEffect: 'none', paymentEffect: 'none', revenueEffect: 'none', loyaltyEffect: 'none', notifyAudience: 'none', notifyTemplateKey: null,
    allowedNext: ['CONFIRMED', 'EDIT', 'CANCELLED'],
    sourceAliases: ['hold', 'on-hold', 'on hold', 'wc-on-hold'],
    sortOrder: 3, active: true, isDefault: false,
  },
  {
    code: 'CONFIRMED', labelEn: 'Confirmed', labelAr: 'مؤكد', customerCode: 'CONFIRMED', icon: 'badge-check',
    stockEffect: 'none', paymentEffect: 'none', revenueEffect: 'none', loyaltyEffect: 'none', notifyAudience: 'customer', notifyTemplateKey: 'order.confirmed',
    allowedNext: ['SHIPPED', 'HOLD', 'EDIT', 'CANCELLED'],
    sourceAliases: ['processing', 'confirmed', 'wc-processing'],
    sortOrder: 4, active: true, isDefault: false,
  },
  {
    code: 'SHIPPED', labelEn: 'Shipped', labelAr: 'تم الشحن', customerCode: 'SHIPPED', icon: 'truck',
    stockEffect: 'none', paymentEffect: 'none', revenueEffect: 'none', loyaltyEffect: 'none', notifyAudience: 'customer', notifyTemplateKey: 'order.shipped',
    allowedNext: ['DELIVERED', 'CANCELLED', 'REFUNDED'],
    sourceAliases: ['shipped', 'wc-shipped'],
    sortOrder: 5, active: true, isDefault: false,
  },
  {
    code: 'DELIVERED', labelEn: 'Delivered', labelAr: 'تم التسليم', customerCode: 'DELIVERED', icon: 'package-check',
    stockEffect: 'none', paymentEffect: 'paid', revenueEffect: 'realize', loyaltyEffect: 'credit', notifyAudience: 'customer', notifyTemplateKey: 'order.delivered',
    allowedNext: ['REFUNDED'],
    sourceAliases: ['delivered', 'completed', 'cash delivered', 'card delivered', 'cash-delivered', 'card-delivered', 'cash_delivered', 'card_delivered', 'wc-completed'],
    sortOrder: 6, active: true, isDefault: false,
  },
  {
    code: 'CANCELLED', labelEn: 'Cancelled', labelAr: 'ملغى', customerCode: 'CANCELLED', icon: 'x-circle',
    stockEffect: 'restock', paymentEffect: 'none', revenueEffect: 'reverse', loyaltyEffect: 'reverse', notifyAudience: 'customer', notifyTemplateKey: 'order.cancelled',
    allowedNext: [],
    sourceAliases: ['cancelled', 'canceled', 'failed', 'wc-cancelled', 'wc-failed'],
    sortOrder: 7, active: true, isDefault: false,
  },
  {
    code: 'REFUNDED', labelEn: 'Refunded', labelAr: 'مُسترد', customerCode: 'REFUNDED', icon: 'rotate-ccw',
    stockEffect: 'restock', paymentEffect: 'refunded', revenueEffect: 'reverse', loyaltyEffect: 'reverse', notifyAudience: 'customer', notifyTemplateKey: 'order.refunded',
    allowedNext: [],
    sourceAliases: ['refunded', 'wc-refunded', 'partially-refunded'],
    sortOrder: 8, active: true, isDefault: false,
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
