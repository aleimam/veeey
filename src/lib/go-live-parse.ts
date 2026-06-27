/** Pure helpers for catalog go-live stock import (no server imports → unit-testable). */

const NO_EXPIRY = /^(na|n\/a|none|-|non[- ]?perishable)$/i;

/** Parse a CSV expiry cell → Date | null (null = non-perishable). Throws on a bad date. */
export function parseExpiryCell(raw: string | undefined): Date | null {
  const v = (raw ?? '').trim();
  if (!v || NO_EXPIRY.test(v)) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error('bad expiry');
  return d;
}
