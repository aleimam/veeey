/**
 * Rule-based fraud / risk scoring (FR-PLAT-02). Pure and unit-tested; thresholds
 * are seeded defaults (admin-tunable later, not hard-coded business rules). A
 * high score flags an order for manual Pay-Check review rather than blocking it.
 */

export type RiskInput = {
  totalPiastres: number;
  isGuest: boolean;
  itemCount: number;
  paymentMethod: string;
  recentOrders24h: number;
  addressProvided: boolean;
};

export type RiskLevel = 'low' | 'medium' | 'high';
export type RiskResult = { score: number; level: RiskLevel; flags: string[] };

export function scoreOrderRisk(input: RiskInput): RiskResult {
  let score = 0;
  const flags: string[] = [];

  if (input.isGuest) {
    score += 15;
    flags.push('guest_checkout');
  }
  if (input.totalPiastres > 5_000_000) {
    // > 50,000 EGP
    score += 25;
    flags.push('high_value');
  }
  if (input.paymentMethod === 'COD' && input.totalPiastres > 2_000_000) {
    // high-value cash-on-delivery
    score += 15;
    flags.push('high_value_cod');
  }
  if (input.recentOrders24h >= 3) {
    score += 25;
    flags.push('order_velocity');
  }
  if (!input.addressProvided && input.paymentMethod !== 'POS_ON_DELIVERY') {
    score += 10;
    flags.push('no_address');
  }
  if (input.itemCount > 20) {
    score += 10;
    flags.push('bulk_order');
  }

  const level: RiskLevel = score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low';
  return { score, level, flags };
}
