import { describe, it, expect } from 'vitest';
import { planCustomer, resolveName, normalizePhone, normalizeEmail, pickTierId, spendToPiastres, type RawCustomer } from './customers-transform';

// Synthetic data only — never real PII in the repo (AGENTS rule #3).
const raw = (o: Partial<RawCustomer> = {}): RawCustomer => ({
  wpUserId: 1, email: 'John@Example.COM', displayName: 'John Doe', firstName: 'John', lastName: 'Doe',
  billingFirst: null, billingLast: null, billingPhone: '+20 100 123 4567',
  billingAddress1: '5 Nile St', billingAddress2: 'Apt 3', billingCity: 'Giza', billingState: 'Giza',
  shippingPhone: null, shippingAddress1: null, shippingAddress2: null, shippingCity: null, shippingState: null, ...o,
});

describe('normalizeEmail / normalizePhone', () => {
  it('lowercases + trims email', () => expect(normalizeEmail('  John@Example.COM ')).toBe('john@example.com'));
  it('strips separators, keeps one leading +', () => {
    expect(normalizePhone('+20 100 123-4567')).toBe('+201001234567');
    expect(normalizePhone('0100 123 4567')).toBe('01001234567');
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});

describe('resolveName', () => {
  it('prefers first/last, falls back to billing then display', () => {
    expect(resolveName({ displayName: 'x', firstName: 'A', lastName: 'B', billingFirst: null, billingLast: null }))
      .toEqual({ firstName: 'A', lastName: 'B', name: 'x' });
    expect(resolveName({ displayName: null, firstName: null, lastName: null, billingFirst: 'C', billingLast: 'D' }))
      .toEqual({ firstName: 'C', lastName: 'D', name: 'C D' });
  });
  it('drops an email-as-display-name when no real name exists', () => {
    expect(resolveName({ displayName: 'joe@x.com', firstName: null, lastName: null, billingFirst: null, billingLast: null }).name).toBeNull();
  });
});

describe('planCustomer', () => {
  it('maps identity + one default billing address', () => {
    const p = planCustomer(raw());
    expect(p.email).toBe('john@example.com');
    expect(p.phone).toBe('+201001234567');
    expect(p.addresses).toHaveLength(1);
    expect(p.addresses[0]).toMatchObject({ governorate: 'Giza', city: 'Giza', area: 'Apt 3', street: '5 Nile St', isDefaultBilling: true, isDefaultShipping: true });
  });

  it('adds a distinct shipping address as the shipping default', () => {
    const p = planCustomer(raw({ shippingAddress1: '9 Tahrir Sq', shippingCity: 'Cairo', shippingState: 'Cairo' }));
    expect(p.addresses).toHaveLength(2);
    expect(p.addresses[0]).toMatchObject({ isDefaultBilling: true, isDefaultShipping: false });
    expect(p.addresses[1]).toMatchObject({ street: '9 Tahrir Sq', city: 'Cairo', isDefaultShipping: true });
  });

  it('produces no address when there is no address data', () => {
    const p = planCustomer(raw({ billingAddress1: null, billingAddress2: null, billingCity: null, billingState: null }));
    expect(p.addresses).toHaveLength(0);
  });
});

describe('pickTierId / spendToPiastres', () => {
  const tiers = [
    { id: 'green', rank: 0, minSpendPiastres: 0n },
    { id: 'silver', rank: 1, minSpendPiastres: 500_00n },
    { id: 'gold', rank: 2, minSpendPiastres: 5000_00n },
  ];
  it('picks the highest tier the spend qualifies for', () => {
    expect(pickTierId(tiers, 0n)).toBe('green');
    expect(pickTierId(tiers, 600_00n)).toBe('silver');
    expect(pickTierId(tiers, 9999_00n)).toBe('gold');
  });
  it('converts EGP totals to piastres, guarding junk', () => {
    expect(spendToPiastres(1234.5)).toBe(123450n);
    expect(spendToPiastres(0)).toBe(0n);
    expect(spendToPiastres(-5)).toBe(0n);
    expect(spendToPiastres(NaN)).toBe(0n);
  });
});
