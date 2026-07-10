import { describe, it, expect } from 'vitest';
import { buildMpEvents, forwardToGa4 } from './ga4-mp';

describe('buildMpEvents', () => {
  it('maps ecommerce events to MP {name, params} and drops unmapped ones', () => {
    const mp = buildMpEvents([
      { name: 'product_view', props: { sku: 'A', name: 'Vit C' } },
      { name: 'page_view' }, // not mapped
      { name: 'purchase', props: { sku: 'A', value: 300, orderId: 'O1' } },
    ]);
    expect(mp.map((e) => e.name)).toEqual(['view_item', 'purchase']);
    expect(mp[1].params.transaction_id).toBe('O1');
    expect(mp[0].params.items).toEqual([{ item_id: 'A', quantity: 1, item_name: 'Vit C' }]);
  });

  it('caps at 25 events', () => {
    const many = Array.from({ length: 40 }, () => ({ name: 'add_to_cart', props: { sku: 'X' } }));
    expect(buildMpEvents(many)).toHaveLength(25);
  });
});

describe('forwardToGa4', () => {
  it('no-ops without config / consent / client id (never calls out)', async () => {
    const ev = [{ name: 'purchase', props: { sku: 'A', value: 1 } }];
    expect(await forwardToGa4({ measurementId: '', apiSecret: 's', clientId: 'c', events: ev, consentAll: true })).toBeNull();
    expect(await forwardToGa4({ measurementId: 'G-1', apiSecret: '', clientId: 'c', events: ev, consentAll: true })).toBeNull();
    expect(await forwardToGa4({ measurementId: 'G-1', apiSecret: 's', clientId: '', events: ev, consentAll: true })).toBeNull();
    expect(await forwardToGa4({ measurementId: 'G-1', apiSecret: 's', clientId: 'c', events: ev, consentAll: false })).toBeNull();
  });

  it('returns {sent:0} when configured but no mappable events (no network call)', async () => {
    const r = await forwardToGa4({ measurementId: 'G-1', apiSecret: 's', clientId: 'c', events: [{ name: 'page_view' }], consentAll: true });
    expect(r).toEqual({ sent: 0 });
  });
});
