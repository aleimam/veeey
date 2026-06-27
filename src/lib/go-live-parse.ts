/** Pure helpers for catalog go-live stock import (no server imports → unit-testable). */

const NO_EXPIRY = /^(na|n\/a|none|-|non[- ]?perishable)$/i;

/**
 * Parse a CSV expiry cell → Date | null (null = non-perishable). Accepts:
 *   • ISO            YYYY-MM-DD  or  YYYY-MM
 *   • Day-first      DD-MM-YYYY  or  DD/MM/YYYY   (Egypt locale — the default)
 *   • Month/year     MM-YYYY     or  MM/YYYY
 * Throws on an unparseable or impossible date (e.g. 31-02-2028).
 */
export function parseExpiryCell(raw: string | undefined): Date | null {
  const v = (raw ?? '').trim();
  if (!v || NO_EXPIRY.test(v)) return null;

  let y: number, mo: number, d: number;
  let m: RegExpMatchArray | null;
  if ((m = v.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/))) {
    y = +m[1]; mo = +m[2]; d = m[3] ? +m[3] : 1; // ISO yyyy-mm[-dd]
  } else if ((m = v.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/))) {
    d = +m[1]; mo = +m[2]; y = +m[3]; // day-first dd-mm-yyyy / dd/mm/yyyy
  } else if ((m = v.match(/^(\d{1,2})[-/](\d{4})$/))) {
    mo = +m[1]; y = +m[2]; d = 1; // month/year mm-yyyy / mm/yyyy
  } else {
    throw new Error('bad expiry');
  }

  if (mo < 1 || mo > 12 || d < 1 || d > 31) throw new Error('bad expiry');
  const date = new Date(Date.UTC(y, mo - 1, d));
  // Reject rollovers / impossible dates (e.g. 31-02 → Mar 2).
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) throw new Error('bad expiry');
  return date;
}
