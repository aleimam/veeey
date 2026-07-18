import { describe, it, expect } from 'vitest';
import { productToWire, parseProductWire } from './catalog-sync';

const loaded = {
  legacyWpId: 120057,
  sku: 'GEN-000123',
  nameEn: 'Vitamin D3 5000IU',
  kind: 'SUPPLEMENT',
  status: 'PUBLISHED',
};

describe('productToWire', () => {
  it('maps the loaded product shape onto the wire (active = PUBLISHED)', () => {
    const w = productToWire(loaded);
    expect(w).toEqual({ wpId: 120057, sku: 'GEN-000123', name: 'Vitamin D3 5000IU', type: 'SUPPLEMENT', active: true });
  });

  it('marks non-PUBLISHED products inactive and passes a null wpId/sku through', () => {
    expect(productToWire({ ...loaded, status: 'DRAFT' }).active).toBe(false);
    expect(productToWire({ ...loaded, status: 'ARCHIVED' }).active).toBe(false);
    const w = productToWire({ ...loaded, legacyWpId: null, sku: null });
    expect(w.wpId).toBeNull();
    expect(w.sku).toBeNull();
  });
});

describe('parseProductWire', () => {
  it('round-trips a wire payload produced by productToWire', () => {
    const w = productToWire(loaded);
    const parsed = parseProductWire(JSON.parse(JSON.stringify(w)));
    expect(parsed).toEqual(w);
  });

  it('rejects a missing/non-integer wpId or a missing name', () => {
    expect(parseProductWire({ sku: 'X', name: 'No wpId', type: 'SUPPLEMENT', active: true })).toBeNull();
    expect(parseProductWire({ wpId: 12.5, name: 'Float wpId' })).toBeNull();
    expect(parseProductWire({ wpId: 120057, type: 'SUPPLEMENT', active: true })).toBeNull();
    expect(parseProductWire({ wpId: 120057, name: '   ' })).toBeNull();
    expect(parseProductWire(null)).toBeNull();
  });

  it('tolerates an absent sku/type and coerces active to a boolean', () => {
    const p = parseProductWire({ wpId: 120057, name: 'Bare' });
    expect(p).toEqual({ wpId: 120057, sku: null, name: 'Bare', type: '', active: false });
  });
});
