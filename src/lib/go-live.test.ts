import { describe, expect, it } from 'vitest';
import { parseExpiryCell } from './go-live-parse';

describe('go-live stock import — expiry parsing', () => {
  it('treats blank / NA variants as non-perishable (null)', () => {
    expect(parseExpiryCell('')).toBeNull();
    expect(parseExpiryCell('  ')).toBeNull();
    expect(parseExpiryCell('NA')).toBeNull();
    expect(parseExpiryCell('n/a')).toBeNull();
    expect(parseExpiryCell('none')).toBeNull();
    expect(parseExpiryCell('-')).toBeNull();
    expect(parseExpiryCell('non-perishable')).toBeNull();
    expect(parseExpiryCell(undefined)).toBeNull();
  });

  it('parses ISO dates (YYYY-MM-DD and YYYY-MM)', () => {
    expect(parseExpiryCell('2027-03-01')?.toISOString().slice(0, 10)).toBe('2027-03-01');
    expect(parseExpiryCell('2028-05')?.toISOString().slice(0, 10)).toBe('2028-05-01');
  });

  it('parses day-first dates (DD-MM-YYYY and DD/MM/YYYY)', () => {
    expect(parseExpiryCell('11-09-2028')?.toISOString().slice(0, 10)).toBe('2028-09-11');
    expect(parseExpiryCell('31/05/2028')?.toISOString().slice(0, 10)).toBe('2028-05-31');
    expect(parseExpiryCell('29-02-2028')?.toISOString().slice(0, 10)).toBe('2028-02-29'); // leap year
  });

  it('parses month/year (MM-YYYY)', () => {
    expect(parseExpiryCell('12-2026')?.toISOString().slice(0, 10)).toBe('2026-12-01');
  });

  it('throws on unparseable or impossible dates', () => {
    expect(() => parseExpiryCell('not-a-date')).toThrow();
    expect(() => parseExpiryCell('31-02-2028')).toThrow(); // Feb 31
    expect(() => parseExpiryCell('00-13-2028')).toThrow();
  });
});
