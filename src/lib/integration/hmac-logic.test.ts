import { describe, expect, it } from 'vitest';
import { canonicalString, sha256hex, signRequest, verifyRequest } from './hmac-logic';

const secret = 'a-shared-secret-at-least-32-chars-long!';
const now = 1_700_000_000_000;
const base = { secret, method: 'POST', path: '/api/integration/v1/requests', timestamp: String(now), nonce: 'nonce-1', rawBody: '{"sku":"VIT-D3"}' };

describe('integration HMAC (contract §1)', () => {
  it('canonical string has 5 newline-joined parts ending in body hash', () => {
    const c = canonicalString('post', '/p', '123', 'n', 'body');
    expect(c.split('\n')).toEqual(['POST', '/p', '123', 'n', sha256hex('body')]);
  });

  it('a freshly signed request verifies', () => {
    const sig = signRequest(base.secret, base.method, base.path, base.timestamp, base.nonce, base.rawBody);
    const r = verifyRequest({ ...base, headers: { clientId: 'veeey', timestamp: base.timestamp, nonce: base.nonce, signature: sig }, nowMs: now });
    expect(r).toEqual({ ok: true });
  });

  it('GET (empty body) signs over sha256("")', () => {
    const sig = signRequest(secret, 'GET', '/health', String(now), 'n2', '');
    const r = verifyRequest({ secret, method: 'GET', path: '/health', rawBody: '', headers: { clientId: 'veeey', timestamp: String(now), nonce: 'n2', signature: sig }, nowMs: now });
    expect(r.ok).toBe(true);
  });

  it('rejects missing headers, bad window, tampered body, and wrong secret', () => {
    const sig = signRequest(base.secret, base.method, base.path, base.timestamp, base.nonce, base.rawBody);
    const hdr = { clientId: 'veeey', timestamp: base.timestamp, nonce: base.nonce, signature: sig };
    expect(verifyRequest({ ...base, headers: { ...hdr, signature: null }, nowMs: now })).toEqual({ ok: false, code: 'missing_headers' });
    expect(verifyRequest({ ...base, headers: hdr, nowMs: now + 6 * 60_000 })).toEqual({ ok: false, code: 'timestamp_out_of_window' });
    expect(verifyRequest({ ...base, rawBody: '{"sku":"X"}', headers: hdr, nowMs: now })).toEqual({ ok: false, code: 'bad_signature' });
    expect(verifyRequest({ ...base, secret: 'wrong', headers: hdr, nowMs: now })).toEqual({ ok: false, code: 'bad_signature' });
  });
});
