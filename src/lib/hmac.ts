import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * HMAC request signing for the AI-MCP + integration read APIs (FR-MCP-01,
 * FR-INT). Signature = hex HMAC-SHA256 over `${timestamp}.${rawBody}` with the
 * client secret. Pure given inputs; constant-time compare; rejects stale stamps.
 */
export function signPayload(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

export function verifySignature(secret: string, timestamp: string, body: string, signature: string, nowMs: number, maxSkewMs = 5 * 60_000): boolean {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowMs - ts) > maxSkewMs) return false;
  const expected = signPayload(secret, timestamp, body);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(signature, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
