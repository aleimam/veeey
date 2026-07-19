import { describe, it, expect } from 'vitest';
import { distinctVariationName, absolutePhotoUrls, productToWireV2, customerToWireV2 } from './product-customer-sync';

const baseProduct = {
  id: 'p1', integrationSku: '120057', legacyWpId: 120057, nameEn: 'Vitamin D3 5000IU',
  kind: 'SUPPLEMENT', variantGroupId: null, variantJson: null, images: [{ url: '/uploads/net/a.webp' }],
};

describe('distinctVariationName (contract v2 §1: variations carry distinct names)', () => {
  it('appends the variant axis values', () => {
    expect(distinctVariationName('HyperGH 14X', { count: { en: '120 tablets', ar: '١٢٠' } })).toBe('HyperGH 14X — 120 tablets');
    expect(distinctVariationName('X', { size: { en: '50ml' }, flavor: { en: 'Mint' } })).toBe('X — 50ml / Mint');
  });
  it('does not double-append when the name already contains the values', () => {
    expect(distinctVariationName('HyperGH 14X — 120 tablets', { count: { en: '120 tablets' } })).toBe('HyperGH 14X — 120 tablets');
  });
  it('leaves the name alone with no usable variant data', () => {
    expect(distinctVariationName('Plain', null)).toBe('Plain');
    expect(distinctVariationName('Plain', {})).toBe('Plain');
  });
});

describe('absolutePhotoUrls (absolute https, ≤6)', () => {
  it('prefixes relative /uploads paths with the site origin', () => {
    expect(absolutePhotoUrls(['/uploads/a.webp', 'https://cdn.x/b.png'], 'https://veeey.net/')).toEqual([
      'https://veeey.net/uploads/a.webp', 'https://cdn.x/b.png',
    ]);
  });
  it('drops unusable entries and caps at 6', () => {
    expect(absolutePhotoUrls(['data:image/x', ''], 'https://v.com')).toEqual([]);
    expect(absolutePhotoUrls(Array.from({ length: 9 }, (_, i) => `/u/${i}.png`), 'https://v.com')).toHaveLength(6);
  });
});

describe('productToWireV2 (contract v2 §1 payload)', () => {
  it('carries sku/legacyWpId/name/type/photos and NOTHING YeldnIN-owns', () => {
    const w = productToWireV2(baseProduct, '120057');
    expect(w).toMatchObject({ sku: '120057', legacyWpId: 120057, name: 'Vitamin D3 5000IU', type: 'SUPPLEMENT' });
    expect(w.photoUrls?.[0]).toMatch(/^https?:\/\/.+\/uploads\/net\/a\.webp$/);
    // §7: estimatedWeight + defaultSupplierName are DROPPED from v1 §4.2.
    expect('estimatedWeight' in w).toBe(false);
    expect('defaultSupplierName' in w).toBe(false);
    expect('archived' in w).toBe(false); // only sent on hard-delete
  });
  it('omits legacyWpId for native products and sets archived on delete', () => {
    const w = productToWireV2({ ...baseProduct, legacyWpId: null, integrationSku: '900001' }, '900001', true);
    expect('legacyWpId' in w).toBe(false);
    expect(w.archived).toBe(true);
  });
  it('uses the distinct variation name for group members', () => {
    const w = productToWireV2({ ...baseProduct, variantGroupId: 'g1', variantJson: { count: { en: '60 caps' } } }, '120057-1');
    expect(w.name).toBe('Vitamin D3 5000IU — 60 caps');
    expect(w.sku).toBe('120057-1');
  });
});

describe('customerToWireV2 (contract v2 §2 — registered only by construction)', () => {
  it('builds name from customer fields, falls back to the user name', () => {
    expect(customerToWireV2({ id: 'c1', firstName: 'Ali', lastName: 'Hassan', user: { name: 'x', phone: '+2010' } }))
      .toEqual({ veeeyCustomerId: 'c1', name: 'Ali Hassan', phone: '+2010' });
    expect(customerToWireV2({ id: 'c2', firstName: null, lastName: null, user: { name: 'Mona', phone: null } }))
      .toEqual({ veeeyCustomerId: 'c2', name: 'Mona' });
  });
  it('flags archived on account deletion', () => {
    expect(customerToWireV2({ id: 'c3', firstName: null, lastName: null, user: { name: null, phone: null } }, true))
      .toMatchObject({ veeeyCustomerId: 'c3', archived: true });
  });
});
