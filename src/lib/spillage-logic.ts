/**
 * Spillage / damage logic (Phase-2), PURE — no DB/IO so it unit-tests without a
 * database. Moves units of a lot into a damage state: a SELLABLE condition
 * (becomes a discounted buy-box variant) or a WRITE-OFF (deducted, lost). The
 * service layer (spillage-service.ts) does the atomic stock moves; this decides
 * *what* should happen and validates the request.
 *
 * Cost is snapshotted per unit for the value reports — but purchase price is
 * often absent (it isn't synced from the WooCommerce source), so reports show
 * UNITS always and VALUE only where a cost exists (owner: units now, cost later).
 */

export const SEED_SPILLAGE_REASONS: Array<{
  code: string;
  labelEn: string;
  labelAr: string;
  sellable: boolean;
  isSystem: boolean;
  sortOrder: number;
}> = [
  { code: 'LOST', labelEn: 'Lost', labelAr: 'مفقود', sellable: false, isSystem: false, sortOrder: 1 },
  { code: 'DAMAGED', labelEn: 'Damaged (destroyed)', labelAr: 'تالف (متلف)', sellable: false, isSystem: false, sortOrder: 2 },
  { code: 'OPEN_BOX', labelEn: 'Open box', labelAr: 'عبوة مفتوحة', sellable: true, isSystem: false, sortOrder: 3 },
  { code: 'NO_BOX', labelEn: 'No box', labelAr: 'بدون عبوة', sellable: true, isSystem: false, sortOrder: 4 },
  { code: 'OPEN_BOTTLE', labelEn: 'Open bottle', labelAr: 'زجاجة مفتوحة', sellable: true, isSystem: false, sortOrder: 5 },
  { code: 'BROKEN_BOTTLE', labelEn: 'Broken bottle', labelAr: 'زجاجة مكسورة', sellable: true, isSystem: false, sortOrder: 6 },
  // System reason for the expiry auto-write-off sweep — not selectable by hand,
  // never deletable, so expired-in-stock losses land in the same report.
  { code: 'EXPIRED', labelEn: 'Expired in stock', labelAr: 'منتهي الصلاحية بالمخزون', sellable: false, isSystem: true, sortOrder: 99 },
];

export type SpillageValidationInput = {
  qty: number;
  lotQtyOnHand: number;
  reasonActive: boolean;
  reasonSellable: boolean;
  /** Discount price (piastres) for the sellable variant lot — required + must be
   *  a positive integer when the reason is sellable; ignored for write-offs. */
  variantPricePiastres?: number | null;
};

export type SpillageValidation = { ok: true } | { ok: false; error: string };

/** Validate a spillage request before any stock is touched. PURE. */
export function validateSpillage(i: SpillageValidationInput): SpillageValidation {
  if (!Number.isInteger(i.qty) || i.qty <= 0) return { ok: false, error: 'qty_positive' };
  if (i.qty > i.lotQtyOnHand) return { ok: false, error: 'qty_exceeds_stock' };
  if (!i.reasonActive) return { ok: false, error: 'reason_inactive' };
  if (i.reasonSellable) {
    const p = i.variantPricePiastres;
    if (p == null || !Number.isInteger(p) || p <= 0) return { ok: false, error: 'variant_price_required' };
  }
  return { ok: true };
}

/** Where a spillage lands: 'variant' (resold) or 'writeoff' (destroyed). PURE. */
export function spillageDisposition(sellable: boolean): 'variant' | 'writeoff' {
  return sellable ? 'variant' : 'writeoff';
}

/** Loss value in piastres for the report — null when no unit cost is known. PURE. */
export function lossValuePiastres(qty: number, unitCostPiastres: bigint | number | null | undefined): bigint | null {
  if (unitCostPiastres == null) return null;
  return BigInt(qty) * BigInt(unitCostPiastres);
}

/**
 * Only the LATEST non-voided entry for a lot may be voided, so the compensating
 * stock move can't corrupt a later action on the same units (owner #4). PURE.
 */
export function canVoidSpillage(entry: { id: string; voidedAt: Date | null }, latestActiveIdForLot: string | null): boolean {
  if (entry.voidedAt != null) return false; // already voided
  return entry.id === latestActiveIdForLot;
}
