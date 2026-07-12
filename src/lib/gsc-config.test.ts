import { describe, expect, it } from 'vitest';
import { gscAuthUrl, defaultProperty, rangeDates, makeOauthState, verifyOauthState } from '@/lib/gsc-config';

describe('gsc-config', () => {
  it('builds an offline consent URL with the right params', () => {
    const url = gscAuthUrl('cid', 'https://veeey.com/cb', 'st');
    expect(url).toContain('client_id=cid');
    expect(url).toContain('access_type=offline');
    expect(url).toContain('prompt=consent');
    expect(url).toContain('scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fwebmasters');
    expect(url).toContain('state=st');
  });

  it('defaults the property to the URL-prefix form', () => {
    expect(defaultProperty('https://veeey.com')).toBe('https://veeey.com/');
  });

  it('computes a lagged date range', () => {
    const { startDate, endDate } = rangeDates(28, '2026-07-12T00:00:00.000Z');
    expect(endDate).toBe('2026-07-10'); // today - 2 (GSC lag)
    expect(startDate).toBe('2026-06-12'); // end - 28
  });

  it('signs and verifies OAuth state with a TTL', () => {
    const now = 1_000_000_000_000;
    const st = makeOauthState(now);
    expect(verifyOauthState(st, now + 1000)).toBe(true);
    expect(verifyOauthState(st, now + 700_000)).toBe(false); // expired (>10 min)
    expect(verifyOauthState('garbage', now)).toBe(false);
    expect(verifyOauthState(st.replace(/\.[^.]+$/, '.tampered'), now)).toBe(false);
  });
});
