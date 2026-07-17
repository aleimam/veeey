import { describe, it, expect } from 'vitest';
import { salesExportHref, salesOrdersHref } from './sales-links';

// S13's whole point is that a download or a drill-through shows the SAME data
// as the panel it came from. These assert the params that carry that promise.
describe('salesExportHref (V6 audit S13)', () => {
  it('carries the active preset, so the CSV covers the window on screen', () => {
    expect(salesExportHref('period', { preset: '7d' })).toBe('/api/admin/analytics/export?report=sales&panel=period&preset=7d');
  });

  it('carries both bounds of a custom window', () => {
    const href = salesExportHref('order-size', { preset: 'custom', from: '2026-03-01', to: '2026-03-31' });
    expect(href).toContain('panel=order-size');
    expect(href).toContain('preset=custom');
    expect(href).toContain('from=2026-03-01');
    expect(href).toContain('to=2026-03-31');
  });

  it('omits bounds a preset does not have, rather than sending empties', () => {
    const href = salesExportHref('lifetime-hist', { preset: 'mtd' });
    expect(href).not.toContain('from=');
    expect(href).not.toContain('to=');
  });

  it('points at the API un-prefixed — a locale would 404 it', () => {
    expect(salesExportHref('period', { preset: 'mtd' }).startsWith('/api/')).toBe(true);
  });
});

describe('salesOrdersHref (V6 audit S13)', () => {
  const start = new Date(2026, 2, 1, 0, 0);
  const end = new Date(2026, 2, 31, 23, 59);

  it('filters Orders to the bookings basis + the panel window', () => {
    expect(salesOrdersHref(start, end)).toBe('/admin/orders?status=booked&from=2026-03-01&to=2026-03-31');
  });

  it('big and normal partition the same window at the threshold', () => {
    const big = salesOrdersHref(start, end, { minTotal: 500 });
    const normal = salesOrdersHref(start, end, { maxTotal: 500 });
    // min inclusive / max exclusive: an order of exactly 500 lands in big only.
    expect(big).toContain('minTotal=500');
    expect(big).not.toContain('maxTotal');
    expect(normal).toContain('maxTotal=500');
    expect(normal).not.toContain('minTotal');
  });

  it('is locale-relative, for next-intl <Link> to prefix', () => {
    expect(salesOrdersHref(start, end).startsWith('/admin/')).toBe(true);
  });

  it('S10: a top product opens the orders that contain it, in the same window', () => {
    const href = salesOrdersHref(start, end, { productId: 'prod_1' });
    expect(href).toContain('productId=prod_1');
    expect(href).toContain('status=booked');
    expect(href).toContain('from=2026-03-01');
  });

  it('uses local calendar days, not UTC — a late-evening end must not slip a day', () => {
    const lateEnd = new Date(2026, 2, 31, 23, 30);
    expect(salesOrdersHref(start, lateEnd)).toContain('to=2026-03-31');
  });
});
