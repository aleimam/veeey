import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Guest checkout-verification cookie (V5 F30). After a guest confirms an OTP,
 * we set a signed cookie binding the verified destination (normalized phone or
 * lowercased email) for VERIFY_TTL_H hours; placeOrder accepts it as proof.
 * Pure module (crypto only) — vitest-friendly.
 */
export const VERIFY_COOKIE = 'veeey-verified';
const VERIFY_TTL_H = 24;

const secret = () => process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'veeey-dev-secret';

const sig = (dest: string, exp: number) =>
  createHmac('sha256', secret()).update(`${dest}|${exp}`).digest('base64url');

/** Cookie value proving `dest` was verified. */
export function makeVerifyCookieValue(dest: string, now = Date.now()): string {
  const exp = now + VERIFY_TTL_H * 3_600_000;
  return `${exp}.${Buffer.from(dest).toString('base64url')}.${sig(dest, exp)}`;
}

/** True when the cookie proves one of `destinations` (already normalized). */
export function verifyCookieMatches(value: string | undefined, destinations: (string | undefined)[], now = Date.now()): boolean {
  if (!value) return false;
  const [expStr, destB64, mac] = value.split('.');
  if (!expStr || !destB64 || !mac) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < now) return false;
  let dest: string;
  try {
    dest = Buffer.from(destB64, 'base64url').toString();
  } catch {
    return false;
  }
  const expected = sig(dest, exp);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  return destinations.some((d) => d && d === dest);
}
