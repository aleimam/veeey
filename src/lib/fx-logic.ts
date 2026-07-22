/**
 * Foreign-exchange conversion for supplier costs — PURE (no DB/network).
 *
 * Suppliers invoice in USD/EUR/AED; Veeey stores money as EGP piastres. The rate
 * is fetched once a day and **pinned onto the lot at approval**, because a cost
 * is a historical fact: a lot bought at 48 EGP/USD must not re-price itself when
 * the rate moves to 52.
 *
 * Provider: open.er-api.com (free, no key, publishes EGP — the ECB-backed
 * services most examples reach for do not).
 */

export type FxQuote = { rate: number; date: string };

/** Currency codes are matched upper-case; blank/absent means the base currency. */
export const normalizeCurrency = (c: string | null | undefined): string => (c ?? '').trim().toUpperCase() || 'EGP';

/**
 * Pull `EGP` out of an open.er-api.com `latest` response.
 *
 * Rejects a non-`success` payload outright rather than reading whatever `rates`
 * happens to hold: an error body still carries a plausible shape, and a wrong
 * rate is worse than no rate — it would be pinned onto the lot and look correct.
 */
export function parseErApiRate(body: unknown, target = 'EGP'): FxQuote | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as { result?: unknown; rates?: unknown; time_last_update_utc?: unknown };
  if (b.result !== 'success') return null;
  if (typeof b.rates !== 'object' || b.rates === null) return null;
  const raw = (b.rates as Record<string, unknown>)[target];
  const rate = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  const stamp = typeof b.time_last_update_utc === 'string' ? new Date(b.time_last_update_utc) : new Date(NaN);
  const date = Number.isNaN(stamp.getTime()) ? '' : stamp.toISOString().slice(0, 10);
  return { rate, date };
}

/** Is a cached quote from today? Rates publish daily, so anything older is stale. */
export function isFreshQuote(cachedDate: string | null | undefined, todayIso: string): boolean {
  return !!cachedDate && cachedDate === todayIso.slice(0, 10);
}

/**
 * Supplier unit cost → EGP piastres, rounded to the nearest piastre.
 *
 * Returns null rather than 0 for a missing cost: 0 would claim the goods were
 * free, and the loss report would then value real stock at nothing.
 */
export function costToPiastres(unitCost: number | null | undefined, rate: number): bigint | null {
  if (unitCost == null || !Number.isFinite(unitCost) || unitCost < 0) return null;
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return BigInt(Math.round(unitCost * rate * 100));
}
