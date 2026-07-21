import { describe, it, expect } from 'vitest';
import { validateSpillage, spillageDisposition, lossValuePiastres, canVoidSpillage, SEED_SPILLAGE_REASONS } from './spillage-logic';

const base = { qty: 5, lotQtyOnHand: 10, reasonActive: true, reasonSellable: false };

describe('validateSpillage', () => {
  it('accepts a valid write-off', () => {
    expect(validateSpillage(base)).toEqual({ ok: true });
  });

  it('rejects a non-positive or non-integer qty', () => {
    expect(validateSpillage({ ...base, qty: 0 }).ok).toBe(false);
    expect(validateSpillage({ ...base, qty: -1 }).ok).toBe(false);
    expect(validateSpillage({ ...base, qty: 1.5 }).ok).toBe(false);
  });

  it('rejects moving more than the lot holds (no negative stock)', () => {
    expect(validateSpillage({ ...base, qty: 11 })).toEqual({ ok: false, error: 'qty_exceeds_stock' });
    expect(validateSpillage({ ...base, qty: 10 }).ok).toBe(true); // exactly all is fine
  });

  it('rejects an inactive reason', () => {
    expect(validateSpillage({ ...base, reasonActive: false })).toEqual({ ok: false, error: 'reason_inactive' });
  });

  it('a SELLABLE reason requires a positive integer variant price', () => {
    const s = { ...base, reasonSellable: true };
    expect(validateSpillage({ ...s, variantPricePiastres: null }).ok).toBe(false);
    expect(validateSpillage({ ...s, variantPricePiastres: 0 }).ok).toBe(false);
    expect(validateSpillage({ ...s, variantPricePiastres: -100 }).ok).toBe(false);
    expect(validateSpillage({ ...s, variantPricePiastres: 4200 }).ok).toBe(true);
  });

  it('a WRITE-OFF ignores the variant price', () => {
    expect(validateSpillage({ ...base, variantPricePiastres: null }).ok).toBe(true);
  });
});

describe('spillageDisposition', () => {
  it('sellable → variant, else write-off', () => {
    expect(spillageDisposition(true)).toBe('variant');
    expect(spillageDisposition(false)).toBe('writeoff');
  });
});

describe('lossValuePiastres', () => {
  it('multiplies qty by unit cost', () => {
    expect(lossValuePiastres(3, 10_000n)).toBe(30_000n);
    expect(lossValuePiastres(3, 10_000)).toBe(30_000n);
  });

  it('returns null when cost is unknown (units-only report)', () => {
    expect(lossValuePiastres(3, null)).toBeNull();
    expect(lossValuePiastres(3, undefined)).toBeNull();
  });
});

describe('canVoidSpillage (only the latest un-voided entry per lot)', () => {
  const now = new Date();
  it('allows voiding the latest active entry', () => {
    expect(canVoidSpillage({ id: 'e2', voidedAt: null }, 'e2')).toBe(true);
  });
  it('blocks voiding an older entry (a later action superseded it)', () => {
    expect(canVoidSpillage({ id: 'e1', voidedAt: null }, 'e2')).toBe(false);
  });
  it('blocks re-voiding an already-voided entry', () => {
    expect(canVoidSpillage({ id: 'e2', voidedAt: now }, 'e2')).toBe(false);
  });
});

describe('seed reasons', () => {
  it('splits into the two buckets exactly as the owner specified', () => {
    const byCode = new Map(SEED_SPILLAGE_REASONS.map((r) => [r.code, r]));
    for (const c of ['LOST', 'DAMAGED', 'EXPIRED']) expect(byCode.get(c)!.sellable).toBe(false);
    for (const c of ['OPEN_BOX', 'NO_BOX', 'OPEN_BOTTLE', 'BROKEN_BOTTLE']) expect(byCode.get(c)!.sellable).toBe(true);
    expect(byCode.get('EXPIRED')!.isSystem).toBe(true);
  });
});
