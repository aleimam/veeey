import { describe, it, expect } from 'vitest';
import { LOT_CONDITIONS, isLotCondition, isConditionVariant, conditionLabel } from './lot-condition';

describe('lot-condition', () => {
  it('defines NEW plus the variant conditions (incl. Phase-2 spillage ones)', () => {
    expect(LOT_CONDITIONS).toEqual(['NEW', 'OPEN_BOX', 'DAMAGED', 'BROKEN', 'NO_BOX', 'OPEN_BOTTLE', 'BROKEN_BOTTLE']);
  });

  it('isLotCondition accepts known codes and rejects anything else', () => {
    for (const c of LOT_CONDITIONS) expect(isLotCondition(c)).toBe(true);
    expect(isLotCondition('new')).toBe(false);
    expect(isLotCondition('')).toBe(false);
    expect(isLotCondition(null)).toBe(false);
    expect(isLotCondition(undefined)).toBe(false);
    expect(isLotCondition(42)).toBe(false);
  });

  it('isConditionVariant is true only for non-NEW conditions', () => {
    expect(isConditionVariant('OPEN_BOX')).toBe(true);
    expect(isConditionVariant('DAMAGED')).toBe(true);
    expect(isConditionVariant('BROKEN')).toBe(true);
    expect(isConditionVariant('NEW')).toBe(false);
    expect(isConditionVariant(null)).toBe(false); // pre-feature order lines
    expect(isConditionVariant(undefined)).toBe(false);
  });

  it('conditionLabel is bilingual; null/NEW → New, unknown codes are humanized (not mislabelled New)', () => {
    expect(conditionLabel('OPEN_BOX', 'en')).toBe('Open-box');
    expect(conditionLabel('OPEN_BOX', 'ar')).toBe('عبوة مفتوحة');
    expect(conditionLabel('NEW', 'en')).toBe('New');
    expect(conditionLabel(null, 'en')).toBe('New');
    // A brand-new admin condition (Phase-2) humanizes rather than hiding as New.
    expect(conditionLabel('NO_BOX', 'en')).toBe('No box');
    expect(conditionLabel('slightly_dented', 'en')).toBe('Slightly dented');
  });
});
