import { describe, expect, it } from 'vitest';
import { costToPiastres, isFreshQuote, normalizeCurrency, parseErApiRate } from './fx-logic';

describe('normalizeCurrency', () => {
  it('upper-cases and treats blank as the base currency', () => {
    expect(normalizeCurrency(' usd ')).toBe('USD');
    expect(normalizeCurrency(null)).toBe('EGP');
    expect(normalizeCurrency('  ')).toBe('EGP');
  });
});

describe('parseErApiRate', () => {
  const ok = { result: 'success', time_last_update_utc: 'Tue, 21 Jul 2026 00:02:31 +0000', rates: { EGP: 48.25, USD: 1 } };

  it('reads the rate and the publication date', () => {
    expect(parseErApiRate(ok)).toEqual({ rate: 48.25, date: '2026-07-21' });
  });

  it('REFUSES an error payload rather than reading whatever rates holds', () => {
    // An error body still has a plausible shape; a wrong rate would be pinned
    // onto the lot and look perfectly correct forever.
    expect(parseErApiRate({ ...ok, result: 'error' })).toBeNull();
    expect(parseErApiRate({ rates: { EGP: 48.25 } })).toBeNull();
  });

  it('rejects a missing, zero, negative or unparseable rate', () => {
    expect(parseErApiRate({ ...ok, rates: { USD: 1 } })).toBeNull();
    expect(parseErApiRate({ ...ok, rates: { EGP: 0 } })).toBeNull();
    expect(parseErApiRate({ ...ok, rates: { EGP: -3 } })).toBeNull();
    expect(parseErApiRate({ ...ok, rates: { EGP: 'soon' } })).toBeNull();
  });

  it('still returns the rate when the date is unusable — the number is the point', () => {
    expect(parseErApiRate({ ...ok, time_last_update_utc: 'whenever' })).toEqual({ rate: 48.25, date: '' });
  });

  it('survives junk input', () => {
    expect(parseErApiRate(null)).toBeNull();
    expect(parseErApiRate('success')).toBeNull();
  });
});

describe('isFreshQuote', () => {
  it('accepts only today, since rates publish daily', () => {
    expect(isFreshQuote('2026-07-22', '2026-07-22T09:00:00.000Z')).toBe(true);
    expect(isFreshQuote('2026-07-21', '2026-07-22T09:00:00.000Z')).toBe(false);
    expect(isFreshQuote(null, '2026-07-22T09:00:00.000Z')).toBe(false);
    expect(isFreshQuote('', '2026-07-22T09:00:00.000Z')).toBe(false);
  });
});

describe('costToPiastres', () => {
  it('converts and rounds to the nearest piastre', () => {
    expect(costToPiastres(10, 48.25)).toBe(48250n);
    expect(costToPiastres(10.336, 1)).toBe(1034n); // 1033.6 → 1034
  });

  it('rounds the float, not the decimal — a documented sub-piastre limit', () => {
    // 1.005 * 100 is 100.49999… in binary floating point, so this rounds DOWN.
    // Left as-is deliberately: the error is under one piastre on a per-unit
    // supplier cost, and decimal arithmetic here would buy nothing real.
    expect(costToPiastres(1.005, 1)).toBe(100n);
  });

  it('an EGP cost passes through at rate 1', () => {
    expect(costToPiastres(250, 1)).toBe(25000n);
  });

  it('returns null — not 0 — for a missing cost, so nothing is valued as free', () => {
    expect(costToPiastres(null, 48)).toBeNull();
    expect(costToPiastres(undefined, 48)).toBeNull();
    expect(costToPiastres(Number.NaN, 48)).toBeNull();
  });

  it('refuses a negative cost or an unusable rate', () => {
    expect(costToPiastres(-5, 48)).toBeNull();
    expect(costToPiastres(10, 0)).toBeNull();
    expect(costToPiastres(10, Number.NaN)).toBeNull();
  });

  it('a zero cost is legitimate (free samples) and stays zero', () => {
    expect(costToPiastres(0, 48)).toBe(0n);
  });
});
