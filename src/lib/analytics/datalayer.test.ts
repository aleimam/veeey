import { describe, it, expect } from 'vitest';
import { gaEvent } from './datalayer';

describe('gaEvent', () => {
  it('maps product_view → view_item with an item', () => {
    const g = gaEvent('product_view', { sku: 'VEY-1', name: 'Vitamin C' });
    expect(g).toMatchObject({ event: 'view_item', ecommerce: true });
    expect(g!.params.items).toEqual([{ item_id: 'VEY-1', quantity: 1, item_name: 'Vitamin C' }]);
    expect(g!.params.currency).toBe('EGP');
  });

  it('computes value from price × quantity when not given', () => {
    const g = gaEvent('add_to_cart', { sku: 'VEY-1', price: 150, qty: 2 });
    expect(g!.event).toBe('add_to_cart');
    expect(g!.params.value).toBe(300);
    expect((g!.params.items as { price: number }[])[0].price).toBe(150);
  });

  it('maps checkout_step → begin_checkout', () => {
    expect(gaEvent('checkout_step', { sku: 'X' })!.event).toBe('begin_checkout');
  });

  it('maps purchase and carries transaction_id + explicit value', () => {
    const g = gaEvent('purchase', { sku: 'VEY-1', value: 500, orderId: 'ORD-9' });
    expect(g).toMatchObject({ event: 'purchase' });
    expect(g!.params.transaction_id).toBe('ORD-9');
    expect(g!.params.value).toBe(500);
  });

  it('maps search → search_term (non-ecommerce)', () => {
    const g = gaEvent('search', { q: 'omega 3' });
    expect(g).toEqual({ event: 'search', params: { search_term: 'omega 3' }, ecommerce: false });
  });

  it('returns null for unmapped events, empty searches, and item-less ecommerce', () => {
    expect(gaEvent('page_view')).toBeNull();
    expect(gaEvent('search', { q: '   ' })).toBeNull();
    expect(gaEvent('add_to_cart', {})).toBeNull(); // no item id
  });
});
