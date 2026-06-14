import { describe, expect, it } from 'vitest';
import { availableQty, daysToExpiry, isExpired, pickFefoLot } from './inventory';

describe('inventory helpers', () => {
  it('availableQty subtracts reservations and floors at 0', () => {
    expect(availableQty({ qtyOnHand: 10, qtyReserved: 3 })).toBe(7);
    expect(availableQty({ qtyOnHand: 2, qtyReserved: 5 })).toBe(0);
  });

  it('daysToExpiry / isExpired', () => {
    expect(daysToExpiry(new Date('2026-07-01'), new Date('2026-06-01'))).toBe(30);
    expect(isExpired({ expiryDate: new Date('2026-01-01') }, new Date('2026-06-01'))).toBe(true);
    expect(isExpired({ expiryDate: new Date('2027-01-01') }, new Date('2026-06-01'))).toBe(false);
  });

  it('pickFefoLot chooses the nearest-expiry LIVE lot with availability', () => {
    const lots = [
      { status: 'LIVE', qtyOnHand: 5, qtyReserved: 0, expiryDate: new Date('2027-09-30') },
      { status: 'LIVE', qtyOnHand: 3, qtyReserved: 0, expiryDate: new Date('2026-08-31') }, // nearest sellable
      { status: 'QUARANTINE', qtyOnHand: 10, qtyReserved: 0, expiryDate: new Date('2026-01-31') },
      { status: 'LIVE', qtyOnHand: 2, qtyReserved: 2, expiryDate: new Date('2026-05-31') }, // no availability
    ];
    expect(pickFefoLot(lots)?.expiryDate.toISOString().slice(0, 7)).toBe('2026-08');
  });

  it('pickFefoLot returns null when nothing is sellable', () => {
    expect(pickFefoLot([{ status: 'QUARANTINE', qtyOnHand: 5, qtyReserved: 0, expiryDate: new Date('2027-01-01') }])).toBeNull();
    expect(pickFefoLot([])).toBeNull();
  });
});
