import { describe, it, expect } from 'vitest';
import { parseUserAgent, clientIp, truncateIp, primaryLanguage } from './enrich';

describe('truncateIp', () => {
  it('zeroes the last IPv4 octet', () => {
    expect(truncateIp('192.168.1.42')).toBe('192.168.1.0');
    expect(truncateIp('41.65.200.9')).toBe('41.65.200.0');
  });
  it('truncates IPv6 to ~/48', () => {
    expect(truncateIp('2001:db8:85a3:8d3:1319:8a2e:370:7348')).toBe('2001:db8:85a3::');
  });
  it('handles null / malformed input', () => {
    expect(truncateIp(null)).toBeNull();
    expect(truncateIp(undefined)).toBeNull();
    expect(truncateIp('')).toBeNull();
  });
});

describe('clientIp', () => {
  it('takes the first hop of an X-Forwarded-For chain', () => {
    expect(clientIp('41.65.200.9, 10.0.0.1, 172.16.0.1')).toBe('41.65.200.9');
  });
  it('falls back to x-real-ip when no XFF', () => {
    expect(clientIp(null, '41.65.200.9')).toBe('41.65.200.9');
  });
  it('returns null when neither present', () => {
    expect(clientIp(null, null)).toBeNull();
    expect(clientIp('')).toBeNull();
  });
});

describe('primaryLanguage', () => {
  it('extracts the first language tag, dropping q-weights', () => {
    expect(primaryLanguage('ar-EG,ar;q=0.9,en;q=0.8')).toBe('ar-EG');
    expect(primaryLanguage('en-US,en;q=0.9')).toBe('en-US');
  });
  it('handles empty input', () => {
    expect(primaryLanguage(null)).toBeNull();
    expect(primaryLanguage('')).toBeNull();
  });
});

describe('parseUserAgent', () => {
  it('classifies a desktop Chrome UA', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const r = parseUserAgent(ua);
    expect(r.browser).toBe('Chrome');
    expect(r.os).toBe('Windows');
    expect(r.deviceType).toBe('desktop');
    expect(r.isBot).toBe(false);
  });
  it('classifies a mobile Safari UA', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    const r = parseUserAgent(ua);
    expect(r.deviceType).toBe('mobile');
    expect(r.os).toBe('iOS');
    expect(r.isBot).toBe(false);
  });
  it('flags a known bot and reports deviceType=bot', () => {
    const r = parseUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)');
    expect(r.isBot).toBe(true);
    expect(r.deviceType).toBe('bot');
  });
  it('handles an empty UA safely', () => {
    const r = parseUserAgent(null);
    expect(r.isBot).toBe(false);
    expect(r.deviceType).toBe('desktop');
  });
});
