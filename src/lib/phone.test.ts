import { describe, expect, it } from 'vitest';
import {
  checkPhoneParts,
  checkPhoneValue,
  dialBounds,
  dialCountry,
  dialLabel,
  isValidPhone,
  joinPhone,
  splitPhone,
  DEFAULT_DIAL,
  OTHER_DIAL,
} from '@/lib/phone';
import { normalizeMobile } from '@/lib/provider-config';

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

describe('splitPhone', () => {
  it('defaults to Egypt and strips the trunk zero from a local number', () => {
    expect(splitPhone('01012345678')).toEqual({ dial: '20', national: '1012345678' });
    expect(splitPhone('')).toEqual({ dial: DEFAULT_DIAL, national: '' });
  });
  it('reads a normalized Egyptian number back apart', () => {
    expect(splitPhone('201012345678')).toEqual({ dial: '20', national: '1012345678' });
    expect(splitPhone('+20 101 234 5678')).toEqual({ dial: '20', national: '1012345678' });
  });
  it('recognises the curated country codes', () => {
    expect(splitPhone('966501234567')).toEqual({ dial: '966', national: '501234567' });
    expect(splitPhone('+971501234567')).toEqual({ dial: '971', national: '501234567' });
    expect(splitPhone('14155552671')).toEqual({ dial: '1', national: '4155552671' });
    expect(splitPhone('442071838750')).toEqual({ dial: '44', national: '2071838750' });
  });
  it('does not mistake a bare Egyptian mobile for a US number', () => {
    // `1` is a real dial code, but `012345678` is not a valid US national number.
    expect(splitPhone('1012345678')).toEqual({ dial: '20', national: '1012345678' });
  });
  it('falls back to free entry for an unrecognised long number', () => {
    expect(splitPhone('8591234567890')).toEqual({ dial: OTHER_DIAL, national: '8591234567890' });
  });
  it('honours a non-Egyptian fallback', () => {
    expect(splitPhone('0501234567', '966')).toEqual({ dial: '966', national: '501234567' });
  });
});

describe('joinPhone', () => {
  it('produces the canonical digits-only wire format', () => {
    expect(joinPhone('20', '1012345678')).toBe('201012345678');
    expect(joinPhone('20', '01012345678')).toBe('201012345678'); // trunk zero dropped
    expect(joinPhone('+966', '50 123 4567')).toBe('966501234567');
  });
  it('is empty when there is no number, so optional fields stay blank', () => {
    expect(joinPhone('20', '')).toBe('');
    expect(joinPhone('20', '   ')).toBe('');
  });
  it('round-trips through splitPhone', () => {
    for (const v of ['201012345678', '966501234567', '14155552671']) {
      const { dial, national } = splitPhone(v);
      expect(joinPhone(dial, national)).toBe(v);
    }
  });
  it('agrees with normalizeMobile, so SMS dispatch keeps matching', () => {
    // The SMS provider normalizer must be a no-op on what we submit.
    for (const v of ['01012345678', '+20 101 234 5678', '201012345678']) {
      const { dial, national } = splitPhone(v);
      const joined = joinPhone(dial, national);
      expect(normalizeMobile(joined)).toBe(joined);
      expect(joined).toBe(normalizeMobile(v));
    }
  });
});

describe('checkPhoneParts', () => {
  it('accepts a well-formed number for the selected country', () => {
    expect(checkPhoneParts('20', '1012345678')).toBeNull();
    expect(checkPhoneParts('965', '51234567')).toBeNull();
  });
  it('names the specific problem', () => {
    expect(checkPhoneParts('20', '')).toBe('required');
    expect(checkPhoneParts('20', '10123')).toBe('too_short');
    expect(checkPhoneParts('20', '10123456789012')).toBe('too_long');
    expect(checkPhoneParts('', '1012345678')).toBe('code_required');
  });
  it('allows an empty optional field', () => {
    expect(checkPhoneParts('20', '', false)).toBeNull();
    // …but still validates one that was filled in.
    expect(checkPhoneParts('20', '123', false)).toBe('too_short');
  });
  it('uses the generic range for a country outside the curated list', () => {
    expect(dialCountry('599')).toBeUndefined();
    expect(dialBounds('599')).toEqual({ min: 4, max: 14 });
    expect(checkPhoneParts('599', '1234567')).toBeNull();
    expect(checkPhoneParts('599', '123')).toBe('too_short');
  });
});

describe('checkPhoneValue (server-side re-validation)', () => {
  it('accepts every format the DB already holds', () => {
    expect(checkPhoneValue('201012345678')).toBeNull();
    expect(checkPhoneValue('01012345678')).toBeNull();
    expect(checkPhoneValue('+966 50 123 4567')).toBeNull();
  });
  it('rejects a too-short number', () => {
    expect(checkPhoneValue('2010')).toBe('too_short');
  });
  it('treats empty as required unless told otherwise', () => {
    expect(checkPhoneValue('')).toBe('required');
    expect(checkPhoneValue('', false)).toBeNull();
  });
});

describe('dialLabel', () => {
  it('is bilingual', () => {
    const eg = dialCountry('20')!;
    expect(dialLabel(eg, 'en')).toBe('Egypt +20');
    expect(dialLabel(eg, 'ar')).toBe('مصر +20');
  });
});
