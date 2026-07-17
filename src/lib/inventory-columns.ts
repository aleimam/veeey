/**
 * Stock & margin per product for the admin list (V7 audit C13). Pure — the DB
 * fetch lives in catalog-service; this stays vitest-friendly.
 */
export type LotLite = { productId: string; qtyOnHand: number; qtyReserved: number; costPiastres: bigint | null };
export type InvSummary = {
  /** Sellable units right now: on-hand minus reserved, LIVE lots only. */
  available: number;
  /** Weighted-average lot cost in piastres, or null when no lot carries a cost. */
  avgCostPiastres: number | null;
};

export function summarizeLots(lots: LotLite[]): Map<string, InvSummary> {
  const acc = new Map<string, { avail: number; costWeighted: number; costQty: number }>();
  for (const l of lots) {
    const a = acc.get(l.productId) ?? { avail: 0, costWeighted: 0, costQty: 0 };
    a.avail += Math.max(0, l.qtyOnHand - l.qtyReserved);
    if (l.costPiastres != null) {
      // Weight by on-hand qty; an empty lot with a cost still informs the
      // average with weight 1 so a cost never silently disappears.
      const w = Math.max(1, l.qtyOnHand);
      a.costWeighted += Number(l.costPiastres) * w;
      a.costQty += w;
    }
    acc.set(l.productId, a);
  }
  const out = new Map<string, InvSummary>();
  for (const [id, a] of acc) {
    out.set(id, { available: a.avail, avgCostPiastres: a.costQty ? Math.round(a.costWeighted / a.costQty) : null });
  }
  return out;
}

/**
 * Margin vs the product's base price. Approximate BY DESIGN: the storefront
 * sells per-lot prices (price-per-expiry), so "the" margin is a range; base
 * price vs weighted-average cost is the honest single number. Null when no
 * cost is recorded — a dash beats a made-up figure.
 */
export function marginOf(basePricePiastres: number, avgCostPiastres: number | null): { piastres: number; pct: number } | null {
  if (avgCostPiastres == null) return null;
  const m = basePricePiastres - avgCostPiastres;
  return { piastres: m, pct: basePricePiastres > 0 ? Math.round((m / basePricePiastres) * 100) : 0 };
}
