/**
 * Order lifecycle (FR-ORD-01). 11 statuses from the live Egypt Vitamins data.
 * Transitions are guarded; the customer-facing timeline collapses them to four
 * stages (Placed → Processing → Shipped → Delivered). Pure + unit-tested.
 */
export const ORDER_STATUSES = [
  'DRAFT',
  'PENDING_CONFIRMATION',
  'PROCESSING',
  'HOLD',
  'EDIT',
  'SHIPPED',
  'CASH_DELIVERED',
  'CARD_DELIVERED',
  'CANCELLED',
  'REFUNDED',
  'FAILED',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ['PENDING_CONFIRMATION', 'EDIT', 'CANCELLED'],
  PENDING_CONFIRMATION: ['PROCESSING', 'HOLD', 'CANCELLED', 'FAILED'],
  PROCESSING: ['HOLD', 'EDIT', 'SHIPPED', 'CANCELLED'],
  HOLD: ['PROCESSING', 'EDIT', 'SHIPPED', 'CANCELLED'],
  EDIT: ['HOLD', 'PROCESSING', 'CANCELLED'],
  SHIPPED: ['CASH_DELIVERED', 'CARD_DELIVERED', 'FAILED', 'REFUNDED'],
  CASH_DELIVERED: ['REFUNDED'],
  CARD_DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
  FAILED: ['PENDING_CONFIRMATION', 'CANCELLED'],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export type TimelineStage = 'PLACED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CLOSED';

export function customerTimeline(status: OrderStatus): TimelineStage {
  switch (status) {
    case 'DRAFT':
    case 'PENDING_CONFIRMATION':
      return 'PLACED';
    case 'PROCESSING':
    case 'HOLD':
    case 'EDIT':
      return 'PROCESSING';
    case 'SHIPPED':
      return 'SHIPPED';
    case 'CASH_DELIVERED':
    case 'CARD_DELIVERED':
      return 'DELIVERED';
    default:
      return 'CLOSED';
  }
}

/** Statuses that mean the order was paid/delivered (revenue realized). */
export function isDelivered(status: OrderStatus): boolean {
  return status === 'CASH_DELIVERED' || status === 'CARD_DELIVERED';
}
