/**
 * Lot condition variants (owner batch #8). A lot is NEW by default; Open-box /
 * Damaged / Broken lots are sold as explicit buy-box variants at a manually
 * discounted lot price (priceOverride). Default FEFO reservation only pools NEW
 * lots — a non-NEW unit is only sold when the customer explicitly picks it, and
 * its condition travels cart → order → invoice.
 */
export const LOT_CONDITIONS = ['NEW', 'OPEN_BOX', 'DAMAGED', 'BROKEN'] as const;
export type LotCondition = (typeof LOT_CONDITIONS)[number];

const LABELS: Record<LotCondition, { en: string; ar: string }> = {
  NEW: { en: 'New', ar: 'جديد' },
  OPEN_BOX: { en: 'Open-box', ar: 'عبوة مفتوحة' },
  DAMAGED: { en: 'Damaged box', ar: 'عبوة متضررة' },
  BROKEN: { en: 'Broken seal', ar: 'غلاف مكسور' },
};

export function isLotCondition(v: unknown): v is LotCondition {
  return typeof v === 'string' && (LOT_CONDITIONS as readonly string[]).includes(v);
}

/** Non-NEW (and non-null) → sold as an explicit condition variant. */
export function isConditionVariant(condition: string | null | undefined): boolean {
  return !!condition && condition !== 'NEW';
}

export function conditionLabel(condition: string | null | undefined, locale = 'en'): string {
  const c: LotCondition = isLotCondition(condition) ? condition : 'NEW';
  return locale === 'ar' ? LABELS[c].ar : LABELS[c].en;
}
