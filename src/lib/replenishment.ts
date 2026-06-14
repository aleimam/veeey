/**
 * Replenishment reminders (FR-REPL-01). Consumption-based: how long a purchased
 * quantity lasts, and when to nudge a reorder. Pure + unit-tested.
 */

/** Days a quantity lasts given servings per unit and daily dose. Null if unknown. */
export function daysOfSupply(servingsPerUnit: number | null | undefined, dailyDosage: number | null | undefined, qty: number): number | null {
  if (!servingsPerUnit || !dailyDosage || dailyDosage <= 0 || qty <= 0) return null;
  return Math.floor((servingsPerUnit * qty) / dailyDosage);
}

/** Reorder a few days before supply runs out (lead time for delivery). */
export function reorderDueDate(purchaseDate: Date, supplyDays: number, leadDays = 5): Date {
  const d = new Date(purchaseDate.getTime());
  d.setUTCDate(d.getUTCDate() + Math.max(0, supplyDays - leadDays));
  return d;
}

/** Whole days from `now` until `due` (negative = overdue). */
export function daysUntil(now: Date, due: Date): number {
  return Math.ceil((due.getTime() - now.getTime()) / 86_400_000);
}
