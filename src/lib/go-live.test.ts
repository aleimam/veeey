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

  it('parses a real date', () => {
    const d = parseExpiryCell('2027-03-01');
    expect(d).toBeInstanceOf(Date);
    expect(d?.getUTCFullYear()).toBe(2027);
  });

  it('throws on an unparseable date', () => {
    expect(() => parseExpiryCell('not-a-date')).toThrow();
  });
});
