/**
 * Behavioral funnel math (FR-ANL-01). Pure — turns raw stage counts into a funnel
 * where each stage's rate is its share of the TOP of the funnel (0–100%), which
 * is the correct way to read a conversion funnel. The rate is clamped to ≤100%
 * so a downstream stage that exceeds views (e.g. off-session / migrated orders)
 * can never render an impossible percentage like the old 29500%. Unit-tested.
 */
export type FunnelCounts = { views: number; carts: number; checkouts: number; orders: number };
export type FunnelStep = { label: string; count: number; rate: number };

export function buildFunnel(c: FunnelCounts): FunnelStep[] {
  const steps: [string, number][] = [
    ['Product views', c.views],
    ['Add to cart', c.carts],
    ['Checkout', c.checkouts],
    ['Orders', c.orders],
  ];
  const top = steps[0][1] || 0;
  return steps.map(([label, count], i) => ({
    label,
    count,
    rate: i === 0 ? 1 : top > 0 ? Math.min(1, count / top) : 0,
  }));
}

/** Overall view → order conversion. */
export function conversionRate(orders: number, views: number): number {
  return views > 0 ? orders / views : 0;
}

// --- P2 insight helpers (pure, unit-tested) --------------------------------

/** Safe ratio clamped to 0..1 (whole ≤ 0 → 0). */
export function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.max(0, Math.min(1, part / whole));
}

/** Share of visitors who saw exactly one page. */
export const bounceRate = (singlePage: number, visitors: number): number => pct(singlePage, visitors);

/** Share of carts that never converted to the next step / purchase. */
export const abandonmentRate = (carts: number, converted: number): number => (carts > 0 ? 1 - pct(converted, carts) : 0);

const dayKey = (ms: number): string => new Date(ms).toISOString().slice(0, 10); // UTC YYYY-MM-DD

/**
 * Fill a contiguous run of the last `days` calendar days (UTC), ending on `endMs`,
 * merging `byDate` values where present and `empty` elsewhere. Pure so the caller
 * passes the clock in — no gaps in the chart when a day had zero traffic.
 */
export function fillDailySeries<T>(endMs: number, days: number, byDate: Map<string, T>, empty: T): Array<{ date: string } & T> {
  const out: Array<{ date: string } & T> = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = dayKey(endMs - i * 86_400_000);
    out.push({ date, ...(byDate.get(date) ?? empty) });
  }
  return out;
}

export type Bucket = { key: string; count: number; share: number };

/**
 * Rank raw {key,count} rows: null/'' keys fold into `unknownLabel`, sorted by
 * count desc, top `limit` kept, each carrying its share of the total.
 */
export function topBuckets(
  rows: Array<{ key: string | null; count: number }>,
  { limit = 8, unknownLabel = 'Unknown' }: { limit?: number; unknownLabel?: string } = {},
): Bucket[] {
  const merged = new Map<string, number>();
  let total = 0;
  for (const r of rows) {
    const k = r.key && r.key.trim() ? r.key : unknownLabel;
    merged.set(k, (merged.get(k) ?? 0) + r.count);
    total += r.count;
  }
  return [...merged.entries()]
    .map(([key, count]) => ({ key, count, share: pct(count, total) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
