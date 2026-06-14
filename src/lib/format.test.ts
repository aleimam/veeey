import { describe, expect, it } from 'vitest';
import { formatEGP, formatPoints } from './format';

describe('formatEGP', () => {
  it('formats whole-EGP amounts from piastres without decimals', () => {
    expect(formatEGP(960300)).toBe('9,603 EGP');
  });

  it('formats fractional EGP amounts with two decimals', () => {
    expect(formatEGP(150050)).toBe('1,500.50 EGP');
  });

  it('formats zero', () => {
    expect(formatEGP(0)).toBe('0 EGP');
  });
});

describe('formatPoints', () => {
  it('formats points with thousands separators', () => {
    expect(formatPoints(12000)).toBe('12,000');
  });
});
