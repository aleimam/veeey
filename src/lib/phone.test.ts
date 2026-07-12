import { describe, expect, it } from 'vitest';
import { isValidPhone } from '@/lib/phone';

describe('isValidPhone', () => {
  it('accepts Egyptian 11-digit numbers starting 01', () => {
    expect(isValidPhone('01012345678')).toBe(true);
    expect(isValidPhone('010 1234 5678')).toBe(true);
    expect(isValidPhone('010-1234-5678')).toBe(true);
  });
  it('rejects wrong-length Egyptian numbers', () => {
    expect(isValidPhone('0101234567')).toBe(false); // 10 digits
    expect(isValidPhone('010123456789')).toBe(false); // 12 digits
    expect(isValidPhone('02012345678')).toBe(false); // not 01
  });
  it('accepts international numbers', () => {
    expect(isValidPhone('+201012345678')).toBe(true);
    expect(isValidPhone('+14155552671')).toBe(true);
    expect(isValidPhone('442071838750')).toBe(true);
  });
  it('rejects junk', () => {
    expect(isValidPhone('')).toBe(false);
    expect(isValidPhone('abc')).toBe(false);
    expect(isValidPhone('12')).toBe(false);
  });
});
