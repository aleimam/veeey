/**
 * Dashboard trend bucketing (pure, testable). Powers the interactive Revenue and
 * Website-visitors cards, each of which toggles between "last 7 days / 7 weeks /
 * 7 months". Given `now`, we produce seven contiguous buckets per granularity and
 * fold pre-aggregated day rows into them — so the page runs two grouped queries
 * (orders-by-day, sessions-by-day) and reuses the results across all three views.
 *
 * All boundaries are computed in the server's local time, matching the rest of the
 * dashboard (which starts days with `new Date(y, m, d)`).
 */

export type TrendGranularity = 'days' | 'weeks' | 'months';
export type TrendBucket = { start: Date; end: Date; label: string };

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dm = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;

/** Seven half-open [start, end) buckets for the given granularity, oldest first. */
export function trendBuckets(gran: TrendGranularity, now: Date, locale = 'en'): TrendBucket[] {
  const months = locale === 'ar' ? MONTHS_AR : MONTHS_EN;
  const out: TrendBucket[] = [];
  if (gran === 'months') {
    for (let i = 6; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      out.push({ start, end, label: months[start.getMonth()] });
    }
    return out;
  }
  const today = dayStart(now);
  const step = gran === 'weeks' ? 7 : 1;
  for (let i = 6; i >= 0; i--) {
    // The newest bucket ends at the start of tomorrow, so it always includes today.
    const end = new Date(today);
    end.setDate(today.getDate() + 1 - i * step);
    const start = new Date(end);
    start.setDate(end.getDate() - step);
    out.push({ start, end, label: dm(start) });
  }
  return out;
}

/** Earliest instant any granularity reaches back to — the query lower bound. */
export function trendSince(now: Date): Date {
  // Seven calendar months back is always the earliest of the three windows.
  return new Date(now.getFullYear(), now.getMonth() - 6, 1);
}

/** Fold rows into buckets: `at` locates a row in time, `value` is what to sum. */
export function bucketize<T>(rows: T[], at: (r: T) => Date, value: (r: T) => number, buckets: TrendBucket[]): number[] {
  const totals = new Array<number>(buckets.length).fill(0);
  for (const r of rows) {
    const t = at(r).getTime();
    for (let i = 0; i < buckets.length; i++) {
      if (t >= buckets[i].start.getTime() && t < buckets[i].end.getTime()) {
        totals[i] += value(r);
        break;
      }
    }
  }
  return totals;
}
