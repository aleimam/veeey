/**
 * Gift-with-purchase rule engine (owner growth feature) — pure + import-clean
 * so it stays unit-testable. A rule matches when ALL of its present conditions
 * hold: subtotal ≥ minSubtotalPiastres, cart contains productId, cart contains
 * a product of categoryId, and `now` is inside the optional schedule window.
 * Grants collapse per gift (two rules granting the same gift → one grant at
 * the larger qty) so a customer never gets duplicate gift lines.
 */

export type GiftRuleRef = {
  id: string;
  nameEn: string;
  nameAr: string | null;
  giftId: string;
  giftQty: number;
  active: boolean;
  minSubtotalPiastres: bigint | null;
  productId: string | null;
  categoryId: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
};

export type GiftRuleCtx = {
  subtotalPiastres: bigint;
  productIds: string[]; // products in the order/cart
  categoryIds: string[]; // categories those products belong to (deduped)
  now: Date;
};

export function ruleMatches(rule: GiftRuleRef, ctx: GiftRuleCtx): boolean {
  if (!rule.active) return false;
  if (rule.startsAt && ctx.now < rule.startsAt) return false;
  if (rule.endsAt && ctx.now > rule.endsAt) return false;
  if (rule.minSubtotalPiastres != null && ctx.subtotalPiastres < rule.minSubtotalPiastres) return false;
  if (rule.productId && !ctx.productIds.includes(rule.productId)) return false;
  if (rule.categoryId && !ctx.categoryIds.includes(rule.categoryId)) return false;
  // A rule with no conditions at all would gift every order — treat as never
  // matching unless it at least has a threshold, product, category or window.
  if (rule.minSubtotalPiastres == null && !rule.productId && !rule.categoryId && !rule.startsAt && !rule.endsAt) return false;
  return true;
}

export type GiftGrant = { giftId: string; qty: number; ruleId: string; ruleNameEn: string; ruleNameAr: string | null };

/** Matching rules → grants, collapsed per gift (largest qty wins). */
export function matchGiftRules(rules: GiftRuleRef[], ctx: GiftRuleCtx): GiftGrant[] {
  const byGift = new Map<string, GiftGrant>();
  for (const r of rules) {
    if (!ruleMatches(r, ctx)) continue;
    const qty = Math.max(1, Math.floor(r.giftQty) || 1);
    const cur = byGift.get(r.giftId);
    if (!cur || qty > cur.qty) byGift.set(r.giftId, { giftId: r.giftId, qty, ruleId: r.id, ruleNameEn: r.nameEn, ruleNameAr: r.nameAr });
  }
  return [...byGift.values()];
}

/** The nearest not-yet-met subtotal-only rule — powers the cart "add EGP X more
 *  to earn Y" nudge. Rules with product/category conditions are excluded (the
 *  nudge can't tell the shopper to add a specific product). */
export function nearestSubtotalRule(rules: GiftRuleRef[], ctx: GiftRuleCtx): { rule: GiftRuleRef; remainingPiastres: bigint } | null {
  let best: { rule: GiftRuleRef; remainingPiastres: bigint } | null = null;
  for (const r of rules) {
    if (!r.active || r.productId || r.categoryId || r.minSubtotalPiastres == null) continue;
    if (r.startsAt && ctx.now < r.startsAt) continue;
    if (r.endsAt && ctx.now > r.endsAt) continue;
    if (ctx.subtotalPiastres >= r.minSubtotalPiastres) continue; // already earned
    const remaining = r.minSubtotalPiastres - ctx.subtotalPiastres;
    if (!best || remaining < best.remainingPiastres) best = { rule: r, remainingPiastres: remaining };
  }
  return best;
}
