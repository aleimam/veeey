/**
 * Pure inventory helpers (FR-INV-*). FEFO = First-Expiry-First-Out. Available
 * quantity excludes soft-held reservations. Kept pure so the selection logic is
 * unit-tested without a database.
 */

export type LotLike = {
  qtyOnHand: number;
  qtyReserved: number;
  expiryDate: Date;
  status: string;
};

/** Sellable quantity = on-hand minus reserved (never negative). */
export function availableQty(lot: Pick<LotLike, 'qtyOnHand' | 'qtyReserved'>): number {
  return Math.max(0, lot.qtyOnHand - lot.qtyReserved);
}

/** Whole days from `now` until the lot expires (negative if already expired). */
export function daysToExpiry(expiry: Date, now: Date): number {
  return Math.floor((expiry.getTime() - now.getTime()) / 86_400_000);
}

export function isExpired(lot: Pick<LotLike, 'expiryDate'>, now: Date): boolean {
  return lot.expiryDate.getTime() < now.getTime();
}

/**
 * FEFO pick: the nearest-expiry LIVE lot that still has available quantity.
 * Returns null when nothing is sellable (→ pre-order / special order).
 */
export function pickFefoLot<T extends LotLike>(lots: T[]): T | null {
  const sellable = lots
    .filter((l) => l.status === 'LIVE' && availableQty(l) > 0)
    .sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime());
  return sellable[0] ?? null;
}
