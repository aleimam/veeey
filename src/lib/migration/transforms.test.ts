import { describe, expect, it } from 'vitest';
import { mapOrderStatus, mapPaymentMethod, normalizePharmacist, clampDate, normalizeLabel } from './transforms';
import { dryRun } from './etl';

describe('migration transforms', () => {
  it('maps Woo order statuses (incl. spacing/casing) to the Veeey statuses', () => {
    expect(mapOrderStatus('Card Delivered')).toEqual({ status: 'DELIVERED', matched: true });
    expect(mapOrderStatus('wc-pending confirmation')).toEqual({ status: 'PENDING', matched: true });
    expect(mapOrderStatus('completed')).toEqual({ status: 'DELIVERED', matched: true });
    expect(mapOrderStatus('processing')).toEqual({ status: 'CONFIRMED', matched: true });
    expect(mapOrderStatus('weird')).toEqual({ status: null, matched: false });
  });

  it('maps payments and flags the ambiguous cheque label', () => {
    expect(mapPaymentMethod('cod').method).toBe('COD');
    expect(mapPaymentMethod('kashier_card').method).toBe('KASHIER');
    const cheque = mapPaymentMethod('cheque');
    expect(cheque.matched).toBe(false);
    expect(cheque.warning).toMatch(/ambiguous/);
  });

  it('collapses pharmacist aliases to a canonical key', () => {
    const aliases = { eltaib: 'user_eltaib', karim: 'user_karim' };
    expect(normalizePharmacist('Dr Eltaib', aliases)).toEqual({ value: 'user_eltaib', matched: true });
    expect(normalizePharmacist('Eltaib', aliases)).toEqual({ value: 'user_eltaib', matched: true });
    expect(normalizePharmacist('Someone Else', aliases).matched).toBe(false);
  });

  it('clamps out-of-range dates', () => {
    const min = new Date('2014-01-01Z'), max = new Date('2026-06-15Z');
    expect(clampDate(new Date('2031-01-01Z'), min, max).clamped).toBe(true);
    expect(clampDate(new Date('2013-01-01Z'), min, max).date.getTime()).toBe(min.getTime());
    expect(clampDate(new Date('2020-01-01Z'), min, max).clamped).toBe(false);
    expect(normalizeLabel('  Cairo   West ')).toBe('Cairo West');
  });
});

describe('migration dry-run', () => {
  it('reports counts + warnings per entity without DB writes', () => {
    const report = dryRun({
      products: [{ sku: 'A', name: 'Vit C' }, { name: 'Orphan' }],
      customers: [{ email: 'a@x.com' }, { email: 'A@X.com' }, { name: 'noemail' }],
      orders: [{ number: 'O1', status: 'Card Delivered', paymentMethod: 'cod' }, { number: 'O2', status: 'weird', paymentMethod: 'cheque' }],
      reviews: [{ sku: 'A', rating: 5, date: '2031-01-01' }, { sku: 'A', rating: null, date: '2020-01-01' }],
    }, { now: new Date('2026-06-15Z') });

    const by = Object.fromEntries(report.reports.map((r) => [r.entity, r]));
    expect(by.products.ok).toBe(1); // orphan (no sku/wpId) flagged
    expect(by.customers.ok).toBe(1); // dup email merged, no-email skipped
    expect(by.orders.ok).toBe(1); // O2 has unmapped status + ambiguous cheque
    expect(by.orders.warnings.length).toBe(2);
    expect(by.reviews.warnings.some((w) => /clamped/.test(w))).toBe(true);
    expect(report.totalWarnings).toBeGreaterThan(0);
  });
});
