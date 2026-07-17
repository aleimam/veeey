/**
 * Pure sales-analytics helpers (period math + value bucketing). No prisma /
 * settings imports so it stays vitest-friendly; the service (sales-analytics.ts)
 * builds on these.
 */
export type PeriodPreset = 'mtd' | '7d' | '30d' | '90d' | 'custom';
export type Range = { start: Date; end: Date; prevStart: Date; prevEnd: Date };
export type Metrics = { count: number; revenue: number; aov: number }; // piastres
export type Bucket = { label: string; count: number };

/**
 * Statuses that don't count as a booking (V6 audit S4). Sales analytics counts
 * orders PLACED in the window minus these, which is why it reports fewer orders
 * than the unfiltered Orders list — the audit saw 417 vs 511 with no explanation
 * on screen.
 *
 * `Order.status` is a free-text code (the editable status engine), so this
 * deliberately also lists spellings that only legacy WooCommerce rows carry
 * (CANCELED / RETURNED / FAILED / VOID) alongside the 8 system codes.
 *
 * ONE list, shared: `order-service` uses it for the `booked` filter so
 * /admin/orders can reproduce the Sales number exactly. Don't inline a copy.
 */
export const NON_BOOKED_STATUSES = ['CANCELLED', 'CANCELED', 'REFUNDED', 'RETURNED', 'FAILED', 'VOID'];

const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
/** True when `d` is the final day of its month (leap-safe). */
const isMonthEnd = (d: Date) => d.getDate() === daysInMonth(d.getFullYear(), d.getMonth());

/**
 * Resolve the selected period + the comparable previous period (V6 audit S3).
 *
 * THE ALGORITHM — one rule set, applied in order:
 *
 *  1. A whole calendar month (custom range from the 1st to the month's last day)
 *     compares to the PRIOR CALENDAR MONTH. Selecting 01–31 Mar compares to
 *     01–28 Feb, not to a 31-day slice starting 29 Jan.
 *  2. Month-to-date compares to the SAME ELAPSED SPAN of the prior calendar
 *     month (1–17 Jul vs 1–17 Jun) — comparing a part-month against a whole one
 *     would be meaningless. The day is CLAMPED to the prior month's length, so
 *     MTD on 31 Mar compares to 01–28 Feb rather than overrunning into March.
 *  3. Everything else (7d/30d/90d and arbitrary custom ranges) compares to an
 *     EQUAL-LENGTH window immediately preceding the selection.
 *
 * Every window is half-open at the join: `prevEnd` is the last millisecond
 * BEFORE `start`. The service filters with gte/lte, so letting prevEnd === start
 * (as it used to) counted a boundary order in both periods.
 *
 * Invariant, all branches: prevEnd < start.
 */
export function periodRange(preset: PeriodPreset, fromIso: string | undefined, toIso: string | undefined, now: Date): Range {
  if (preset === 'custom' && fromIso && toIso) {
    const start = new Date(`${fromIso}T00:00:00`);
    const end = new Date(new Date(`${toIso}T00:00:00`).getTime() + 86_400_000 - 1); // inclusive end of day
    const prevEnd = new Date(start.getTime() - 1);

    // (1) whole calendar month → prior calendar month
    if (start.getDate() === 1 && isMonthEnd(new Date(`${toIso}T00:00:00`)) && start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
      return { start, end, prevStart: new Date(start.getFullYear(), start.getMonth() - 1, 1), prevEnd };
    }

    // (3) equal-length preceding window
    const lenMs = end.getTime() - start.getTime() + 1;
    return { start, end, prevStart: new Date(start.getTime() - lenMs), prevEnd };
  }

  if (preset === '7d' || preset === '30d' || preset === '90d') {
    // (3) equal-length preceding window
    const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
    const end = new Date(now);
    const start = new Date(end);
    start.setDate(start.getDate() - days);
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - days);
    return { start, end, prevStart, prevEnd: new Date(start.getTime() - 1) };
  }

  // (2) month-to-date vs the same elapsed span of the previous month
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const day = Math.min(now.getDate(), daysInMonth(prevStart.getFullYear(), prevStart.getMonth()));
  const prevEnd = new Date(
    prevStart.getFullYear(),
    prevStart.getMonth(),
    day,
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds(),
  );
  return { start, end, prevStart, prevEnd };
}

export type TrendGrain = 'day' | 'week' | 'month';
export type TrendPoint = { date: string; revenue: number; orders: number }; // revenue in piastres

/** Local YYYY-MM-DD (never UTC — a late-evening order must not slip a day). */
const ymdLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * How finely to slice a window (V6 audit S10). A 90-day range at daily grain is
 * 90 unreadable columns, so longer windows step up to weeks then months.
 */
export function trendGrain(start: Date, end: Date): TrendGrain {
  const days = (end.getTime() - start.getTime()) / 86_400_000;
  if (days <= 31) return 'day';
  if (days <= 92) return 'week';
  return 'month';
}

/** The bucket an order falls in: its day, its ISO-ish week start (Mon), or its month. */
const bucketStart = (d: Date, grain: TrendGrain): Date => {
  if (grain === 'month') return new Date(d.getFullYear(), d.getMonth(), 1);
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (grain === 'day') return day;
  const dow = (day.getDay() + 6) % 7; // Mon = 0
  day.setDate(day.getDate() - dow);
  return day;
};

const nextBucket = (d: Date, grain: TrendGrain): Date =>
  grain === 'month'
    ? new Date(d.getFullYear(), d.getMonth() + 1, 1)
    : new Date(d.getFullYear(), d.getMonth(), d.getDate() + (grain === 'week' ? 7 : 1));

/**
 * Revenue + order count per bucket across the whole window (V6 audit S10).
 *
 * Buckets with no orders are emitted as zeros rather than skipped: a trend that
 * silently drops its quiet days draws a continuous line through them and
 * overstates what happened.
 */
export function salesTrend(orders: { placedAt: Date; totalPiastres: number }[], start: Date, end: Date, grain = trendGrain(start, end)): TrendPoint[] {
  const points = new Map<string, TrendPoint>();
  for (let b = bucketStart(start, grain); b <= end; b = nextBucket(b, grain)) {
    points.set(ymdLocal(b), { date: ymdLocal(b), revenue: 0, orders: 0 });
  }
  for (const o of orders) {
    const key = ymdLocal(bucketStart(o.placedAt, grain));
    const p = points.get(key);
    if (!p) continue; // outside the window — the query shouldn't return these
    p.revenue += o.totalPiastres;
    p.orders += 1;
  }
  return [...points.values()];
}

export const VALUE_EDGES = [0, 50000, 100000, 200000, 300000, 500000]; // piastres
export const LIFETIME_EDGES = [0, 50000, 100000, 300000, 500000, 1000000];

export const bucketLabels = (edges: number[]): string[] =>
  edges.map((e, i) => (i === edges.length - 1 ? `${e / 100}+` : `${e / 100}–${edges[i + 1] / 100}`));

/** Bucket order totals (piastres) into value bands. Pure. */
export function bucketByValue(totals: number[], edges = VALUE_EDGES): Bucket[] {
  const labels = bucketLabels(edges);
  const counts = new Array(edges.length).fill(0);
  for (const t of totals) {
    let idx = 0;
    for (let i = 0; i < edges.length; i++) if (t >= edges[i]) idx = i;
    counts[idx]++;
  }
  return labels.map((label, i) => ({ label, count: counts[i] }));
}
