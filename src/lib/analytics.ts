/**
 * Behavioral funnel math (FR-ANL-01). Pure — turns raw stage counts into a funnel
 * with step-over-step conversion rates. Unit-tested.
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
  return steps.map(([label, count], i) => ({
    label,
    count,
    rate: i === 0 ? 1 : count / (steps[i - 1][1] || 1),
  }));
}

/** Overall view → order conversion. */
export function conversionRate(orders: number, views: number): number {
  return views > 0 ? orders / views : 0;
}
