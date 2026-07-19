/**
 * Loyalty standing math (V5 F29) — pure, import-clean, unit-tested.
 * A customer's tier = the highest-threshold tier their lifetime spend meets
 * (ties broken by rank). Tier rows come from the DB; thresholds are
 * admin-editable piastre values.
 */

export type TierRef = { id: string; rank: number; minSpendPiastres: bigint };

/** Highest tier whose threshold the spend meets; null only when no tier qualifies
 *  (shouldn't happen — the base tier's threshold is 0). */
export function pickTierId(tiers: TierRef[], spendPiastres: bigint): string | null {
  let best: TierRef | null = null;
  for (const t of tiers) {
    if (spendPiastres < t.minSpendPiastres) continue;
    if (!best || t.minSpendPiastres > best.minSpendPiastres || (t.minSpendPiastres === best.minSpendPiastres && t.rank > best.rank)) {
      best = t;
    }
  }
  return best?.id ?? null;
}

/** Does this customer row need a write? (spend or tier out of date) */
export function standingChanged(
  current: { lifetimeSpendPiastres: bigint; tierId: string | null },
  next: { spendPiastres: bigint; tierId: string | null },
): boolean {
  return current.lifetimeSpendPiastres !== next.spendPiastres || current.tierId !== next.tierId;
}

/**
 * Is a manual/paid tier lock ACTIVE? While active, auto-recompute and the
 * net-sync customer pull must not touch tierId. `until` null = indefinite
 * manual assignment; a date = paid membership (e.g. SELECT for one year),
 * expired once passed. PURE.
 */
export function manualTierActive(tierManual: boolean, until: Date | null, now: Date = new Date()): boolean {
  if (!tierManual) return false;
  return until == null || until.getTime() > now.getTime();
}
