/**
 * Veeey Refill — pure logic (no DB/auth imports; unit-tested). The service
 * (refill-service.ts) runs the COD autoship engine; these helpers own frequency
 * parsing, schedule advancement, notice timing and the discount math.
 */

export const REFILL_STATUSES = ['ACTIVE', 'PAUSED', 'CANCELLED'] as const;
export type RefillStatus = (typeof REFILL_STATUSES)[number];

/** Parse the admin frequencies setting ("30,45,60,90") → sorted unique days (7–180). */
export function parseFrequencies(raw: string | null | undefined, fallback = [30, 45, 60, 90]): number[] {
  const days = (raw ?? '')
    .split(',')
    .map((s) => Math.round(Number(s.trim())))
    .filter((n) => Number.isFinite(n) && n >= 7 && n <= 180);
  const uniq = [...new Set(days)].sort((a, b) => a - b);
  return uniq.length ? uniq : fallback;
}

/** Advance a plan's nextRunAt past `now` (catch-up in one hop — a plan paused
 *  for months must not fire a burst of back-orders when resumed). */
export function advanceNextRun(nextRunAt: Date, frequencyDays: number, now: Date): Date {
  const freqMs = Math.max(1, frequencyDays) * 86_400_000;
  let next = nextRunAt.getTime() + freqMs;
  while (next <= now.getTime()) next += freqMs;
  return new Date(next);
}

/** Advance-notice SMS is due when the run is within `noticeDays` and we haven't
 *  already noticed THIS run (noticedRunAt equals the current nextRunAt). */
export function noticeDue(plan: { nextRunAt: Date; noticedRunAt: Date | null }, now: Date, noticeDays: number): boolean {
  if (plan.nextRunAt.getTime() - now.getTime() > noticeDays * 86_400_000) return false;
  return plan.noticedRunAt?.getTime() !== plan.nextRunAt.getTime();
}

/** Refill discount on a subtotal (integer piastres, BigInt-safe). */
export function refillDiscount(subtotalPiastres: bigint, percent: number): bigint {
  const pct = Math.min(90, Math.max(0, Math.round(percent)));
  return (subtotalPiastres * BigInt(pct)) / 100n;
}

/** Address snapshot validation — an auto-order needs a deliverable address. */
export type RefillAddress = { name: string; phone: string; governorate: string; city: string; area: string; street: string };
export function parseRefillAddress(raw: unknown): RefillAddress | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const s = (k: string) => (typeof r[k] === 'string' ? (r[k] as string).trim() : '');
  const addr: RefillAddress = { name: s('name'), phone: s('phone'), governorate: s('governorate'), city: s('city'), area: s('area'), street: s('street') };
  return addr.name && addr.phone && addr.governorate && addr.city && addr.street ? addr : null;
}
