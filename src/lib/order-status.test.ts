import { describe, expect, it } from 'vitest';
import { canTransition, customerTimeline, isDelivered, ORDER_STATUSES } from './order-status';

describe('order lifecycle', () => {
  it('has the 11 live statuses', () => {
    expect(ORDER_STATUSES).toHaveLength(11);
  });

  it('allows valid transitions and blocks invalid ones', () => {
    expect(canTransition('PENDING_CONFIRMATION', 'PROCESSING')).toBe(true);
    expect(canTransition('PROCESSING', 'SHIPPED')).toBe(true);
    expect(canTransition('SHIPPED', 'CASH_DELIVERED')).toBe(true);
    expect(canTransition('PENDING_CONFIRMATION', 'CASH_DELIVERED')).toBe(false); // can't skip
    expect(canTransition('CANCELLED', 'PROCESSING')).toBe(false); // terminal
  });

  it('collapses statuses to the customer timeline', () => {
    expect(customerTimeline('PENDING_CONFIRMATION')).toBe('PLACED');
    expect(customerTimeline('HOLD')).toBe('PROCESSING');
    expect(customerTimeline('SHIPPED')).toBe('SHIPPED');
    expect(customerTimeline('CARD_DELIVERED')).toBe('DELIVERED');
    expect(customerTimeline('REFUNDED')).toBe('CLOSED');
  });

  it('recognises delivered (revenue) statuses', () => {
    expect(isDelivered('CASH_DELIVERED')).toBe(true);
    expect(isDelivered('CARD_DELIVERED')).toBe(true);
    expect(isDelivered('SHIPPED')).toBe(false);
  });
});
