import { describe, expect, it } from 'vitest';
import { toCardProduct, type DbCardProduct } from './storefront';

const base: DbCardProduct = {
  id: 'prod_1',
  slugEn: 'vitamin-c',
  slugAr: 'vitamin-c-ar',
  nameEn: 'Vitamin C',
  nameAr: 'فيتامين سي',
  basePricePiastres: 85000n,
  ratingAvg: 4.5,
  ratingCount: 10,
  brand: { nameEn: 'Solgar' },
  images: [{ url: '/x.webp' }],
  lots: [],
};

describe('toCardProduct', () => {
  it('uses the base price and nearest expiry for an in-stock product', () => {
    const c = toCardProduct(
      { ...base, lots: [{ expiryDate: new Date('2027-09-30'), saleFlag: false, priceOverridePiastres: null }] },
      'en',
    );
    expect(c.pricePiastres).toBe(85000);
    expect(c.oldPricePiastres).toBeUndefined();
    expect(c.expiry).toBe('Exp 09/2027');
    expect(c.badge).toBeUndefined();
    expect(c.points).toBe(850);
    expect(c.slug).toBe('vitamin-c');
    expect(c.name).toBe('Vitamin C');
  });

  it('applies a price-per-expiry sale lot with struck base price', () => {
    const c = toCardProduct(
      { ...base, lots: [{ expiryDate: new Date('2026-08-31'), saleFlag: true, priceOverridePiastres: 59500n }] },
      'en',
    );
    expect(c.pricePiastres).toBe(59500);
    expect(c.oldPricePiastres).toBe(85000);
    expect(c.badge).toEqual({ type: 'short-expiry', label: 'Short expiry' });
  });

  it('marks a product with no stock as pre-order', () => {
    const c = toCardProduct(base, 'en');
    expect(c.expiry).toBe('Pre-order');
    expect(c.badge).toEqual({ type: 'pre-order', label: 'Pre-order · 25% deposit' });
  });

  it('uses Arabic slug + name in the ar locale', () => {
    const c = toCardProduct(base, 'ar');
    expect(c.slug).toBe('vitamin-c-ar');
    expect(c.name).toBe('فيتامين سي');
  });
});
