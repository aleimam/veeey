import { describe, expect, it } from 'vitest';
import { needsUnicodeSms, toUcs2Hex } from '@/lib/sms-encoding';

describe('sms encoding', () => {
  it('detects when Unicode mode is needed', () => {
    expect(needsUnicodeSms('Veeey SMS test - working.')).toBe(false);
    expect(needsUnicodeSms('line1\nline2')).toBe(false);
    expect(needsUnicodeSms('em — dash')).toBe(true);
    expect(needsUnicodeSms('رسالة عربية')).toBe(true);
  });

  it('encodes UTF-16 code units as 4-digit uppercase hex', () => {
    expect(toUcs2Hex('A')).toBe('0041');
    expect(toUcs2Hex('AB')).toBe('00410042');
    // Arabic meem U+0645, space U+0020
    expect(toUcs2Hex('م ')).toBe('06450020');
    // em dash U+2014
    expect(toUcs2Hex('—')).toBe('2014');
  });

  it('handles surrogate pairs (emoji) as two code units', () => {
    // 😀 U+1F600 → D83D DE00
    expect(toUcs2Hex('😀')).toBe('D83DDE00');
  });
});
