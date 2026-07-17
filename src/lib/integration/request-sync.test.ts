import { describe, it, expect } from 'vitest';
import { requestToWire, parseWireRequest } from './request-sync';

const loaded = {
  uid: 'REQ2607014',
  type: 'SPECIAL_ORDER',
  status: 'PENDING',
  scope: 'EGV',
  notes: 'From order VO-1001',
  depositPiastres: 88000n, // 880.00 EGP
  autoOptional: false,
  archivedAt: null,
  customer: { id: 'cus_1', name: 'Ada Lovelace', phone: '+20100' },
  orderNumber: 'VO-1001',
  lines: [
    { count: 2, sellingPricePiastres: 350000n, notes: null, sku: 'VIT-D3', productName: 'Vitamin D3' },
    { count: 1, sellingPricePiastres: null, notes: 'urgent', sku: null, productName: 'Mystery' },
  ],
  photoUrls: ['/uploads/a.webp'],
};

describe('requestToWire', () => {
  it('maps piastres → EGP numbers and flattens the loaded shape', () => {
    const w = requestToWire(loaded);
    expect(w.uid).toBe('REQ2607014');
    expect(w.depositEgp).toBe(880);
    expect(w.customer).toEqual({ name: 'Ada Lovelace', phone: '+20100', veeeyCustomerId: 'cus_1' });
    expect(w.veeeyOrderId).toBe('VO-1001');
    expect(w.lines[0]).toEqual({ sku: 'VIT-D3', productName: 'Vitamin D3', quantity: 2, sellingPriceEgp: 3500, notes: null });
    expect(w.lines[1].sellingPriceEgp).toBeNull();
    expect(w.archived).toBe(false);
  });

  it('emits a null customer + null deposit when absent', () => {
    const w = requestToWire({ ...loaded, customer: null, depositPiastres: null, orderNumber: null });
    expect(w.customer).toBeNull();
    expect(w.depositEgp).toBeNull();
    expect(w.veeeyOrderId).toBeNull();
  });
});

describe('parseWireRequest', () => {
  it('round-trips a wire payload produced by requestToWire', () => {
    const w = requestToWire(loaded);
    const parsed = parseWireRequest(JSON.parse(JSON.stringify(w)));
    expect(parsed).not.toBeNull();
    expect(parsed!.uid).toBe('REQ2607014');
    expect(parsed!.type).toBe('SPECIAL_ORDER');
    expect(parsed!.depositEgp).toBe(880);
    expect(parsed!.lines).toHaveLength(2);
  });

  it('rejects unknown type, missing uid, or no valid lines', () => {
    expect(parseWireRequest({ uid: 'X', type: 'BOGUS', lines: [{ sku: 'A', quantity: 1, productName: 'A' }] })).toBeNull();
    expect(parseWireRequest({ type: 'RESTOCK', lines: [{ sku: 'A', quantity: 1, productName: 'A' }] })).toBeNull();
    expect(parseWireRequest({ uid: 'X', type: 'RESTOCK', lines: [] })).toBeNull();
    expect(parseWireRequest(null)).toBeNull();
  });

  it('accepts all four types + defaults an unknown status to PENDING', () => {
    for (const t of ['SPECIAL_ORDER', 'OUT_OF_STOCK', 'RESTOCK', 'OPTIONAL']) {
      const p = parseWireRequest({ uid: 'REQ1', type: t, status: 'WEIRD', lines: [{ sku: 'A', quantity: 3, productName: 'A' }] });
      expect(p?.type).toBe(t);
      expect(p?.status).toBe('PENDING');
    }
  });

  it('drops lines with neither sku nor product name but keeps the valid ones', () => {
    const p = parseWireRequest({ uid: 'REQ1', type: 'RESTOCK', lines: [{ quantity: 1 }, { sku: 'A', quantity: 2, productName: 'A' }] });
    expect(p?.lines).toHaveLength(1);
    expect(p?.lines[0].quantity).toBe(2);
  });
});
