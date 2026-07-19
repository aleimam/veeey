import { describe, it, expect } from 'vitest';
import { SYSTEM_BENEFITS } from './tier-benefit-keys';

/** Keys are wired into checkout/special-order enforcement AND stored as DB rows —
 *  renaming one would strand its grants. Pin the contract. */
describe('SYSTEM_BENEFITS contract', () => {
  it('keys are unique and stable', () => {
    const keys = SYSTEM_BENEFITS.map((b) => b.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(['freeShipping', 'freeUltraFast', 'specialOrder', 'preOrder', 'discreetShipping']);
  });
  it('v1 seeding changes nothing: gates open to all, fee waivers off', () => {
    for (const b of SYSTEM_BENEFITS) {
      const isGate = ['specialOrder', 'preOrder', 'discreetShipping'].includes(b.key);
      expect(b.grantAll).toBe(isGate);
    }
  });
  it('every benefit is bilingual', () => {
    for (const b of SYSTEM_BENEFITS) {
      expect(b.nameEn.length).toBeGreaterThan(0);
      expect((b.nameAr ?? '').length).toBeGreaterThan(0);
    }
  });
});
