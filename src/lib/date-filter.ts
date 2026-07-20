/**
 * Shared day-range filter for date-only admin filters (`?from=YYYY-MM-DD&to=…`).
 *
 * Why this exists: the orders LIST expanded `to` to 23:59:59 while the CSV
 * EXPORT used `new Date(to)` — midnight at the START of that day — so the same
 * filter produced different result sets and exports silently dropped the final
 * day (Codex audit P1). Both now go through this one helper so they cannot
 * drift again.
 *
 * `to` is inclusive of the whole day: we use an EXCLUSIVE next-day upper bound
 * (`lt`) rather than 23:59:59, so rows timestamped in the last second — or with
 * sub-second precision — are not lost.
 */
export type DayRangeFilter = { gte?: Date; lt?: Date };

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Start-of-day for a YYYY-MM-DD string, or null when unparseable. */
function startOfDay(day: string): Date | null {
  if (!DATE_ONLY.test(day)) {
    const loose = new Date(day);
    return Number.isNaN(loose.getTime()) ? null : loose;
  }
  const d = new Date(`${day}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Build a Prisma date filter covering [from 00:00, to 24:00). Returns undefined
 * when neither bound is usable, so callers can spread it conditionally. PURE.
 */
export function dayRangeFilter(from?: string | null, to?: string | null): DayRangeFilter | undefined {
  const gte = from ? startOfDay(from) : null;
  const toStart = to ? startOfDay(to) : null;
  // Inclusive end-of-day = exclusive start of the NEXT day.
  const lt = toStart ? new Date(toStart.getFullYear(), toStart.getMonth(), toStart.getDate() + 1) : null;
  if (!gte && !lt) return undefined;
  return { ...(gte ? { gte } : {}), ...(lt ? { lt } : {}) };
}
