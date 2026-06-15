import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { kashierAmount, kashierOrderHash, kashierVerify, kashierWebhookSigned, opaySignature, opayVerify, safeEqualHex } from './payment-crypto';

describe('payment-crypto', () => {
  it('formats Kashier amounts from piastres', () => {
    expect(kashierAmount(2000n)).toBe('20');
    expect(kashierAmount(15050n)).toBe('150.5');
    expect(kashierAmount(0n)).toBe('0');
  });

  it('builds the documented Kashier order hash', () => {
    const apiKey = 'test_api_key';
    const expected = createHmac('sha256', apiKey).update('/?payment=MID-46-111.ORD1.20.EGP').digest('hex');
    expect(kashierOrderHash({ mid: 'MID-46-111', orderId: 'ORD1', amount: '20', currency: 'EGP', apiKey })).toBe(expected);
  });

  it('verifies a Kashier redirect signature (params except signature & mode)', () => {
    const secret = 'svc_secret';
    const base = { paymentStatus: 'SUCCESS', merchantOrderId: 'VY-1', amount: '20', currency: 'EGP' };
    const qs = Object.entries(base).map(([k, v]) => `${k}=${v}`).join('&');
    const signature = createHmac('sha256', secret).update(qs).digest('hex');
    expect(kashierVerify({ ...base, mode: 'test', signature }, secret)).toBe(true);
    // tampered amount fails
    expect(kashierVerify({ ...base, amount: '2000', mode: 'test', signature }, secret)).toBe(false);
    // wrong secret fails
    expect(kashierVerify({ ...base, mode: 'test', signature }, 'other')).toBe(false);
    // missing signature fails
    expect(kashierVerify(base, secret)).toBe(false);
  });

  it('verifies a Kashier webhook using its signatureKeys array', () => {
    const apiKey = 'iframe_key';
    const data: Record<string, unknown> = {
      transactionId: 'TX1', orderReference: 'VY-9', status: 'SUCCESS', amount: '20',
      signatureKeys: ['transactionId', 'orderReference', 'status', 'amount'],
    };
    const qs = (data.signatureKeys as string[]).map((k) => `${k}=${data[k]}`).join('&');
    data.signature = createHmac('sha256', apiKey).update(qs).digest('hex');
    expect(kashierWebhookSigned(data, apiKey)).toBe(true);
    expect(kashierWebhookSigned(data, 'wrong')).toBe(false);
    expect(kashierWebhookSigned({ status: 'SUCCESS' }, apiKey)).toBe(false); // no keys/sig
  });

  it('signs and verifies OPay payloads with HMAC-SHA512', () => {
    const secret = 'OPAYPRV_x';
    const payload = JSON.stringify({ reference: 'VY-1', amount: { total: 2000, currency: 'EGP' } });
    const sig = opaySignature(payload, secret);
    expect(sig).toHaveLength(128); // sha512 hex
    expect(opayVerify(payload, sig, secret)).toBe(true);
    expect(opayVerify(payload, sig, 'wrong')).toBe(false);
  });

  it('safeEqualHex is length-safe', () => {
    expect(safeEqualHex('abc', 'abc')).toBe(true);
    expect(safeEqualHex('abc', 'abd')).toBe(false);
    expect(safeEqualHex('abc', 'abcd')).toBe(false);
  });
});
