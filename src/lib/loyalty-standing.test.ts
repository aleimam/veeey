import { describe, it, expect } from 'vitest';
import { pickTierId, standingChanged, type TierRef } from './loyalty-standing';

const TIERS: TierRef[] = [
  { id: 'green', rank: 1, minSpendPiastres: 0n },
  { id: 'vip', rank: 2, minSpendPiastres: 2_000_000n }, // EGP 20k
  { id: 'select', rank: 3, minSpendPiastres: 5_000_000n }, // EGP 50k
];

describe('pickTierId', () => {
  it('assigns the highest threshold met', () => {
    expect(pickTierId(TIERS, 0n)).toBe('green');
    expect(pickTierId(TIERS, 1_999_999n)).toBe('green');
    expect(pickTierId(TIERS, 2_000_000n)).toBe('vip');
    expect(pickTierId(TIERS, 4_999_999n)).toBe('vip');
    expect(pickTierId(TIERS, 5_000_000n)).toBe('select');
    expect(pickTierId(TIERS, 99_000_000n)).toBe('select');
  });

  it('breaks threshold ties by rank and handles empty/unqualified sets', () => {
    const tie: TierRef[] = [
      { id: 'a', rank: 1, minSpendPiastres: 0n },
      { id: 'b', rank: 2, minSpendPiastres: 0n },
    ];
    expect(pickTierId(tie, 100n)).toBe('b');
    expect(pickTierId([], 100n)).toBeNull();
    expect(pickTierId([{ id: 'x', rank: 1, minSpendPiastres: 500n }], 100n)).toBeNull();
  });
});

describe('standingChanged', () => {
  it('detects spend or tier drift, ignores no-ops', () => {
    expect(standingChanged({ lifetimeSpendPiastres: 100n, tierId: 'green' }, { spendPiastres: 100n, tierId: 'green' })).toBe(false);
    expect(standingChanged({ lifetimeSpendPiastres: 100n, tierId: 'green' }, { spendPiastres: 200n, tierId: 'green' })).toBe(true);
    expect(standingChanged({ lifetimeSpendPiastres: 100n, tierId: 'green' }, { spendPiastres: 100n, tierId: 'vip' })).toBe(true);
    expect(standingChanged({ lifetimeSpendPiastres: 0n, tierId: null }, { spendPiastres: 0n, tierId: 'green' })).toBe(true);
  });
});
