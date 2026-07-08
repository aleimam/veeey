import { headers } from 'next/headers';

/**
 * Minimal in-process fixed-window rate limiter for public endpoints (login,
 * register, reviews, questions, special orders). The app runs as a single PM2
 * process, so in-memory state is authoritative enough here; if we ever scale
 * to multiple app instances this should move to Postgres/Redis.
 */

const buckets = new Map<string, { n: number; resetAt: number }>();

/** True = allowed. Counts a hit against `key` within the window. */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > 20_000) {
    for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { n: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.n >= max) return false;
  b.n++;
  return true;
}

/** Client IP for rate-limit keys (nginx sets x-forwarded-for in prod). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? 'unknown').trim();
}
