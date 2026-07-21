/**
 * Lot condition variants (owner batch #8). A lot is NEW by default; Open-box /
 * Damaged / Broken lots are sold as explicit buy-box variants at a manually
 * discounted lot price (priceOverride). Default FEFO reservation only pools NEW
 * lots — a non-NEW unit is only sold when the customer explicitly picks it, and
 * its condition travels cart → order → invoice.
 */
export const LOT_CONDITIONS = ['NEW', 'OPEN_BOX', 'DAMAGED', 'BROKEN', 'NO_BOX', 'OPEN_BOTTLE', 'BROKEN_BOTTLE'] as const;
export type LotCondition = (typeof LOT_CONDITIONS)[number];

const LABELS: Record<LotCondition, { en: string; ar: string }> = {
  NEW: { en: 'New', ar: 'جديد' },
  OPEN_BOX: { en: 'Open-box', ar: 'عبوة مفتوحة' },
  DAMAGED: { en: 'Damaged box', ar: 'عبوة متضررة' },
  BROKEN: { en: 'Broken seal', ar: 'غلاف مكسور' },
  // Phase-2 spillage sellable conditions.
  NO_BOX: { en: 'No box', ar: 'بدون عبوة' },
  OPEN_BOTTLE: { en: 'Open bottle', ar: 'زجاجة مفتوحة' },
  BROKEN_BOTTLE: { en: 'Broken bottle', ar: 'زجاجة مكسورة' },
};

/** Humanize an unknown condition code (e.g. a brand-new admin reason) so the
 *  buy-box shows "Slightly dented" rather than mislabelling it "New". */
function humanize(code: string): string {
  return code.toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

export function isLotCondition(v: unknown): v is LotCondition {
  return typeof v === 'string' && (LOT_CONDITIONS as readonly string[]).includes(v);
}

/** Non-NEW (and non-null) → sold as an explicit condition variant. */
export function isConditionVariant(condition: string | null | undefined): boolean {
  return !!condition && condition !== 'NEW';
}

export function conditionLabel(condition: string | null | undefined, locale = 'en'): string {
  if (!condition || condition === 'NEW') return locale === 'ar' ? LABELS.NEW.ar : LABELS.NEW.en;
  if (isLotCondition(condition)) return locale === 'ar' ? LABELS[condition].ar : LABELS[condition].en;
  // Unknown (admin-added) condition — humanize rather than fall back to "New",
  // which would hide that it's a non-new variant.
  return humanize(condition);
}
