import { describe, expect, it } from 'vitest';
import { makeVerifyCookieValue, verifyCookieMatches } from '@/lib/verify-cookie';

describe('verify cookie', () => {
  it('round-trips a verified destination', () => {
    const v = makeVerifyCookieValue('201001234567');
    expect(verifyCookieMatches(v, ['201001234567'])).toBe(true);
    expect(verifyCookieMatches(v, ['someone@example.com', '201001234567'])).toBe(true);
  });

  it('rejects other destinations, missing and undefined values', () => {
    const v = makeVerifyCookieValue('201001234567');
    expect(verifyCookieMatches(v, ['201009999999'])).toBe(false);
    expect(verifyCookieMatches(v, [undefined])).toBe(false);
    expect(verifyCookieMatches(undefined, ['201001234567'])).toBe(false);
  });

  it('rejects expired and tampered cookies', () => {
    const past = Date.now() - 48 * 3_600_000;
    const expired = makeVerifyCookieValue('201001234567', past);
    expect(verifyCookieMatches(expired, ['201001234567'])).toBe(false);

    const v = makeVerifyCookieValue('201001234567');
    const [exp, , mac] = v.split('.');
    const forged = `${exp}.${Buffer.from('201009999999').toString('base64url')}.${mac}`;
    expect(verifyCookieMatches(forged, ['201009999999'])).toBe(false);
    expect(verifyCookieMatches('garbage', ['201001234567'])).toBe(false);
  });

  it('works for emails', () => {
    const v = makeVerifyCookieValue('user@example.com');
    expect(verifyCookieMatches(v, ['user@example.com'])).toBe(true);
    expect(verifyCookieMatches(v, ['other@example.com'])).toBe(false);
  });
});
