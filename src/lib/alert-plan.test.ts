import { describe, it, expect } from 'vitest';
import { alertVars, alertKind, alertDedupeKey, formatAlertPrice, type AlertEvent } from './alert-plan';

const ev = (over: Partial<AlertEvent> = {}): AlertEvent => ({
  type: 'PRICE_DROP',
  newValue: '850',
  product: { nameEn: 'Omega-3', nameAr: 'أوميجا-٣', slugEn: 'omega-3', slugAr: 'أوميجا-3', ...over.product },
  ...over,
});

describe('alertVars', () => {
  it('localizes name + link per customer locale', () => {
    expect(alertVars(ev(), 'en')).toEqual({ product: 'Omega-3', price: '850', link: 'https://veeey.com/en/products/omega-3' });
    const ar = alertVars(ev(), 'ar');
    expect(ar.product).toBe('أوميجا-٣');
    expect(ar.link).toBe('https://veeey.com/ar/products/أوميجا-3');
  });

  it('falls back to EN name/slug when Arabic is missing', () => {
    const e = ev({ product: { nameEn: 'CoQ10', nameAr: null, slugEn: 'coq10', slugAr: null } });
    const ar = alertVars(e, 'ar');
    expect(ar.product).toBe('CoQ10');
    expect(ar.link).toBe('https://veeey.com/ar/products/coq10');
  });

  it('unknown locale behaves as EN', () => {
    expect(alertVars(ev(), 'fr').link).toContain('/en/products/');
  });
});

describe('alert kind + dedupe', () => {
  it('PRICE_DROP and SALE_LOT collapse to one price alert per customer × product', () => {
    expect(alertKind('PRICE_DROP')).toBe('price');
    expect(alertKind('SALE_LOT')).toBe('price');
    expect(alertKind('BACK_IN_STOCK')).toBe('stock');
    expect(alertDedupeKey('c1', 'omega-3', 'PRICE_DROP')).toBe(alertDedupeKey('c1', 'omega-3', 'SALE_LOT'));
    expect(alertDedupeKey('c1', 'omega-3', 'BACK_IN_STOCK')).not.toBe(alertDedupeKey('c1', 'omega-3', 'PRICE_DROP'));
    expect(alertDedupeKey('c2', 'omega-3', 'PRICE_DROP')).not.toBe(alertDedupeKey('c1', 'omega-3', 'PRICE_DROP'));
  });
});

describe('formatAlertPrice', () => {
  it('formats numerics, trims .00, empty for junk', () => {
    expect(formatAlertPrice('850')).toBe('850');
    expect(formatAlertPrice('849.5')).toBe('849.50');
    expect(formatAlertPrice('')).toBe('');
    expect(formatAlertPrice(null)).toBe('');
    expect(formatAlertPrice('abc')).toBe('');
  });
});
