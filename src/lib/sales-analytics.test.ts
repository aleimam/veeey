import { describe, expect, it } from 'vitest';
import { periodRange, bucketByValue, NON_BOOKED_STATUSES } from '@/lib/sales-analytics-core';
import { ORDER_STATUSES } from '@/lib/order-status';

/** Local-time YYYY-MM-DD, so assertions read like the dates a user picks. */
const at = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('periodRange', () => {
  const now = new Date('2026-07-12T10:00:00.000Z');

  it('MTD compares to the same elapsed span of the previous month', () => {
    const r = periodRange('mtd', undefined, undefined, now);
    expect(r.start.getFullYear()).toBe(2026);
    expect(r.start.getMonth()).toBe(6); // July (0-indexed)
    expect(r.start.getDate()).toBe(1);
    expect(r.prevStart.getMonth()).toBe(5); // June
    expect(r.prevStart.getDate()).toBe(1);
    // previous window spans the same elapsed time as MTD
    expect(r.end.getTime() - r.start.getTime()).toBe(r.prevEnd.getTime() - r.prevStart.getTime());
  });

  it('rolling windows put the previous window immediately before', () => {
    const r = periodRange('30d', undefined, undefined, now);
    expect(Math.round((r.end.getTime() - r.start.getTime()) / 86_400_000)).toBe(30);
    expect(Math.round((r.prevEnd.getTime() - r.prevStart.getTime()) / 86_400_000)).toBe(30);
  });

  it('custom range mirrors length into the previous window', () => {
    const r = periodRange('custom', '2026-07-01', '2026-07-10', now);
    expect(r.start.getFullYear()).toBe(2026);
    expect(r.prevEnd.getTime()).toBeLessThan(r.start.getTime());
  });
});

// The V6 audit (S3) found "vs previous" comparing 01–31 Mar against 29 Jan–28 Feb.
// Probing the fix turned up two more: MTD on a 31st ran the previous window THREE
// DAYS INTO the current one (same orders counted on both sides of the delta), and
// every rolling preset put prevEnd exactly ON start, so the boundary order was
// counted twice under the service's gte/lte filter.
describe('periodRange — previous-period boundaries (V6 audit S3)', () => {
  const mar31 = new Date(2026, 2, 31, 12, 0); // a 31-day month, prior month is short

  it('never lets the previous window touch the current one', () => {
    const cases = [
      periodRange('mtd', undefined, undefined, mar31),
      periodRange('7d', undefined, undefined, mar31),
      periodRange('30d', undefined, undefined, mar31),
      periodRange('90d', undefined, undefined, mar31),
      periodRange('custom', '2026-03-01', '2026-03-31', mar31),
      periodRange('custom', '2026-03-05', '2026-03-09', mar31),
    ];
    for (const r of cases) {
      expect(r.prevStart.getTime()).toBeLessThan(r.prevEnd.getTime());
      expect(r.prevEnd.getTime()).toBeLessThan(r.start.getTime()); // strictly before: no double-count
    }
  });

  it('a whole calendar month compares to the whole PRIOR calendar month, not a 31-day slice', () => {
    const r = periodRange('custom', '2026-03-01', '2026-03-31', mar31);
    expect(at(r.prevStart)).toBe('2026-02-01');
    expect(at(r.prevEnd)).toBe('2026-02-28'); // was 29 Jan–28 Feb before the fix
  });

  it('compares February to January, and January to the prior YEAR December', () => {
    const feb = periodRange('custom', '2026-02-01', '2026-02-28', mar31);
    expect(at(feb.prevStart)).toBe('2026-01-01');
    expect(at(feb.prevEnd)).toBe('2026-01-31');

    const jan = periodRange('custom', '2026-01-01', '2026-01-31', mar31);
    expect(at(jan.prevStart)).toBe('2025-12-01');
    expect(at(jan.prevEnd)).toBe('2025-12-31');
  });

  it('recognises a leap February as a whole month (29 days)', () => {
    const r = periodRange('custom', '2024-02-01', '2024-02-29', mar31);
    expect(at(r.prevStart)).toBe('2024-01-01');
    expect(at(r.prevEnd)).toBe('2024-01-31');
  });

  it('a partial month is NOT a calendar month — it mirrors its own length', () => {
    const r = periodRange('custom', '2026-03-01', '2026-03-30', mar31); // 30 of 31 days
    expect(at(r.prevStart)).toBe('2026-01-30');
    expect(at(r.prevEnd)).toBe('2026-02-28');
  });

  it('MTD on a 31st clamps to the short prior month instead of overrunning into it', () => {
    const r = periodRange('mtd', undefined, undefined, mar31);
    expect(at(r.start)).toBe('2026-03-01');
    expect(at(r.prevStart)).toBe('2026-02-01');
    expect(at(r.prevEnd)).toBe('2026-02-28'); // was 3 Mar — INSIDE the current window
  });

  it('MTD clamps onto a leap day rather than past it', () => {
    const r = periodRange('mtd', undefined, undefined, new Date(2024, 2, 30, 12, 0));
    expect(at(r.prevEnd)).toBe('2024-02-29');
  });

  it('MTD mid-month compares day-for-day', () => {
    const r = periodRange('mtd', undefined, undefined, new Date(2026, 6, 17, 12, 0));
    expect(at(r.prevStart)).toBe('2026-06-01');
    expect(at(r.prevEnd)).toBe('2026-06-17');
  });

  it('rolling presets mirror their exact length immediately before the window', () => {
    for (const [preset, days] of [['7d', 7], ['30d', 30], ['90d', 90]] as const) {
      const r = periodRange(preset, undefined, undefined, mar31);
      expect(Math.round((r.prevEnd.getTime() - r.prevStart.getTime()) / 86_400_000)).toBe(days);
      expect(r.start.getTime() - r.prevEnd.getTime()).toBe(1); // adjacent, not overlapping
    }
  });
});

// S4: Sales reported 417 orders where the Orders list showed 511. The gap is
// this list. It's exported so /admin/orders?status=booked can reproduce the
// exact number — if the two ever diverge, the reconciliation link lies.
describe('NON_BOOKED_STATUSES (V6 audit S4)', () => {
  it('excludes exactly the cancelled-like system statuses, and keeps the earning ones', () => {
    const excludedSystem = ORDER_STATUSES.filter((s) => NON_BOOKED_STATUSES.includes(s));
    expect(excludedSystem).toEqual(['CANCELLED', 'REFUNDED']);

    for (const s of ['PENDING', 'EDIT', 'HOLD', 'CONFIRMED', 'SHIPPED', 'DELIVERED']) {
      expect(NON_BOOKED_STATUSES).not.toContain(s);
    }
  });

  it('also covers legacy WooCommerce spellings (status is free text, not an enum)', () => {
    for (const legacy of ['CANCELED', 'RETURNED', 'FAILED', 'VOID']) {
      expect(NON_BOOKED_STATUSES).toContain(legacy);
    }
  });
});

describe('bucketByValue', () => {
  it('assigns each total to its band (piastres)', () => {
    // EGP 300, 700, 1500, 4000, 9000 → bands 0–500 / 500–1000 / 1000–2000 / 3000–5000 / 5000+
    const b = bucketByValue([30000, 70000, 150000, 400000, 900000]);
    const byLabel = Object.fromEntries(b.map((x) => [x.label, x.count]));
    expect(byLabel['0–500']).toBe(1);
    expect(byLabel['500–1000']).toBe(1);
    expect(byLabel['1000–2000']).toBe(1);
    expect(byLabel['3000–5000']).toBe(1);
    expect(byLabel['5000+']).toBe(1);
  });

  it('handles an empty set', () => {
    expect(bucketByValue([]).every((b) => b.count === 0)).toBe(true);
  });
});
