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
