import { describe, expect, it } from 'vitest';
import { resolveStoreKey, orderToDeliveryWire, addressText, type DeliveryOrderInput } from './delivery-wire';

const SNAP = { name: 'Ali Hassan', phone: '+201001234567', governorate: 'Cairo', city: 'Nasr City', area: 'Zone 6', street: '5 Nile St' };

const base: DeliveryOrderInput = {
  number: 'VY-ABC-123',
  placedAt: new Date('2026-07-21T09:00:00.000Z'),
  paymentMethod: 'COD',
  paymentState: 'PENDING',
  totalPiastres: 45000n, // 450.00 EGP
  shippingAddressJson: SNAP,
  lines: [{ sku: 'VEY-CEN-00914', name: 'Centrum', qty: 2 }],
};

describe('resolveStoreKey', () => {
  it('reads the store from a site URL, tolerating scheme/www/port', () => {
    expect(resolveStoreKey('https://veeey.net')).toBe('veeey.net');
    expect(resolveStoreKey('https://www.veeey.com/')).toBe('veeey.com');
    expect(resolveStoreKey('veeey.net:3100')).toBe('veeey.net');
  });

  it('an explicit override wins over the site URL', () => {
    expect(resolveStoreKey('https://veeey.com', 'veeey.net')).toBe('veeey.net');
  });

  it('refuses an unknown host instead of guessing (YeldnIN rejects unknown stores)', () => {
    expect(resolveStoreKey('https://example.com')).toBeNull();
    expect(resolveStoreKey('')).toBeNull();
    expect(resolveStoreKey(undefined)).toBeNull();
  });
});

describe('orderToDeliveryWire', () => {
  it('builds a COD delivery with the total to collect, in PIASTRES', () => {
    const w = orderToDeliveryWire('veeey.net', base)!;
    expect(w.storeKey).toBe('veeey.net');
    expect(w.orderNumber).toBe('VY-ABC-123');
    expect(w.paymentMethod).toBe('COD');
    expect(w.collectAmountEgp).toBe(45000); // piastres, despite the field name
    expect(w.customer).toEqual({ name: 'Ali Hassan', phone: '+201001234567', altPhone: null });
    expect(w.address.zone).toBe('Cairo');
    expect(w.address.subArea).toBe('Zone 6');
    expect(w.address.text).toBe('5 Nile St, Zone 6, Nasr City, Cairo');
    expect(w.lines).toEqual([{ sku: 'VEY-CEN-00914', name: 'Centrum', qty: 2 }]);
    expect(w.placedAt).toBe('2026-07-21T09:00:00.000Z');
  });

  it("the order's own address phone wins over the account phone (that's who the courier calls)", () => {
    const w = orderToDeliveryWire('veeey.net', { ...base, customerPhone: '+20999999999' })!;
    expect(w.customer.phone).toBe('+201001234567'); // from the order snapshot
    // …but the account phone is the fallback when the order carried none.
    const w2 = orderToDeliveryWire('veeey.net', {
      ...base,
      shippingAddressJson: { ...SNAP, phone: undefined },
      customerPhone: '+20999999999',
    })!;
    expect(w2.customer.phone).toBe('+20999999999');
  });

  it('an already-PAID order is PREPAID and collects nothing (never collect twice)', () => {
    const w = orderToDeliveryWire('veeey.net', { ...base, paymentState: 'PAID' })!;
    expect(w.paymentMethod).toBe('PREPAID');
    expect(w.collectAmountEgp).toBe(0);
  });

  it('card/wallet methods are prepaid; POS-on-delivery still collects', () => {
    expect(orderToDeliveryWire('veeey.net', { ...base, paymentMethod: 'KASHIER' })!.paymentMethod).toBe('PREPAID');
    expect(orderToDeliveryWire('veeey.net', { ...base, paymentMethod: 'POS_ON_DELIVERY' })!.paymentMethod).toBe('COD');
  });

  it('refuses to build what YeldnIN would reject (no store / name / address)', () => {
    expect(orderToDeliveryWire(null, base)).toBeNull();
    expect(orderToDeliveryWire('veeey.net', { ...base, shippingAddressJson: { name: 'A' } })).toBeNull(); // no address
    expect(orderToDeliveryWire('veeey.net', { ...base, shippingAddressJson: { governorate: 'Cairo' } })).toBeNull(); // no name
    expect(orderToDeliveryWire('veeey.net', { ...base, number: '  ' })).toBeNull();
  });

  it('drops unlabelled lines and floors quantities to at least 1', () => {
    const w = orderToDeliveryWire('veeey.net', {
      ...base,
      lines: [{ sku: null, name: '', qty: 3 }, { sku: null, name: 'Gift', qty: 0 }],
    })!;
    expect(w.lines).toEqual([{ sku: null, name: 'Gift', qty: 1 }]);
  });

  it('addressText skips missing parts without leaving stray commas', () => {
    expect(addressText({ governorate: 'Giza', city: 'Dokki' })).toBe('Dokki, Giza');
    expect(addressText({})).toBe('');
  });
});
