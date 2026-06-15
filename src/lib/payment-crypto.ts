import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Pure payment-gateway signing helpers (FR-PAY-*). No DB/network imports so the
 * unit tests stay fast and the webhook/redirect builders can reuse them. Specs
 * confirmed from Kashier (Php-Checkout-Demo) + OPay (cashier-create / payment-
 * authentication) docs.
 */

/** Constant-time hex string compare (returns false on length mismatch). */
export function safeEqualHex(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

// ---- Kashier (Hosted Payment Page) -----------------------------------------

/** EGP piastres → Kashier decimal amount string (15050n → "150.5", 2000n → "20").
 *  The exact same string MUST be used in both the hash and the redirect URL. */
export function kashierAmount(piastres: bigint): string {
  return String(Number(piastres) / 100);
}

/** Kashier order hash: HMAC-SHA256 of `/?payment={mid}.{orderId}.{amount}.{currency}`
 *  with the merchant's Payment API key (hex). */
export function kashierOrderHash(p: { mid: string; orderId: string; amount: string; currency: string; apiKey: string }): string {
  const path = `/?payment=${p.mid}.${p.orderId}.${p.amount}.${p.currency}`;
  return createHmac('sha256', p.apiKey).update(path).digest('hex');
}

/** Verify a Kashier redirect/webhook payload: HMAC-SHA256 over every param except
 *  `signature` and `mode`, joined as `k=v&k=v` in the given order, with the secret
 *  key — compared (constant-time) to the supplied `signature`. The caller must pass
 *  params in the order received (URLSearchParams / object insertion order). */
export function kashierVerify(params: Record<string, string>, secretKey: string): boolean {
  const sig = params.signature;
  if (!sig) return false;
  const qs = Object.keys(params)
    .filter((k) => k !== 'signature' && k !== 'mode')
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  const expected = createHmac('sha256', secretKey).update(qs).digest('hex');
  return safeEqualHex(expected, sig);
}

/** Verify a Kashier server webhook. Kashier's webhook `data` object carries a
 *  `signatureKeys` array naming exactly which fields (and order) were signed, plus
 *  the `signature`. HMAC-SHA256 over `k=v&k=v` of those keys with the given key. */
export function kashierWebhookSigned(data: Record<string, unknown>, key: string): boolean {
  const keys = Array.isArray(data.signatureKeys) ? (data.signatureKeys as string[]) : null;
  const sig = typeof data.signature === 'string' ? data.signature : undefined;
  if (!keys || keys.length === 0 || !sig) return false;
  const qs = keys.map((k) => `${k}=${data[k] ?? ''}`).join('&');
  const expected = createHmac('sha256', key).update(qs).digest('hex');
  return safeEqualHex(expected, sig);
}

// ---- OPay (Cashier) --------------------------------------------------------

/** OPay request/callback signature: HMAC-SHA512 of the (stringified JSON) payload
 *  with the merchant secret/private key (hex). Used for status-query & callback
 *  verification. */
export function opaySignature(payload: string, secretKey: string): string {
  return createHmac('sha512', secretKey).update(payload).digest('hex');
}

/** Verify an OPay callback `sha512` against the JSON-stringified payload. */
export function opayVerify(payloadJson: string, sha512: string, secretKey: string): boolean {
  return safeEqualHex(opaySignature(payloadJson, secretKey), sha512);
}
