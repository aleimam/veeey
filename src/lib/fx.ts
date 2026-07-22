import { prisma } from '@/lib/prisma';
import { isFreshQuote, normalizeCurrency, parseErApiRate, type FxQuote } from '@/lib/fx-logic';

/**
 * Daily FX rates → EGP, cached in `Setting` under `fx.rate.<CUR>`.
 *
 * A cache, not configuration — which is why it writes `Setting` rows directly
 * instead of going through the admin settings registry. Nobody should be editing
 * these by hand.
 *
 * **An approval must never hard-fail because a free third-party API is down.**
 * So the fallback ladder is: today's cached rate → live fetch → *any* cached
 * rate, flagged stale → give up and store no cost. Losing a cost is recoverable;
 * refusing to book goods that are physically on the shelf is not.
 */

const PROVIDER = 'https://open.er-api.com/v6/latest';
const KEY = (cur: string) => `fx.rate.${cur}`;

export type FxResult = FxQuote & { stale: boolean };

type Cached = { rate: number; date: string; fetchedAt: string };

async function readCache(cur: string): Promise<Cached | null> {
  const row = await prisma.setting.findUnique({ where: { key: KEY(cur) }, select: { value: true } });
  if (!row) return null;
  try {
    const c = JSON.parse(row.value) as Cached;
    return Number.isFinite(c?.rate) && c.rate > 0 ? c : null;
  } catch {
    return null; // a corrupt cache entry is a missing one, not a crash
  }
}

async function writeCache(cur: string, q: FxQuote, now: Date) {
  const value = JSON.stringify({ rate: q.rate, date: q.date, fetchedAt: now.toISOString() } satisfies Cached);
  await prisma.setting.upsert({ where: { key: KEY(cur) }, create: { key: KEY(cur), value }, update: { value } });
}

async function fetchLive(cur: string): Promise<FxQuote | null> {
  try {
    const res = await fetch(`${PROVIDER}/${encodeURIComponent(cur)}`, {
      // A redirect here would hand back some other document as "the rate".
      redirect: 'manual',
      signal: AbortSignal.timeout(8_000),
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    return parseErApiRate(await res.json());
  } catch {
    return null; // offline, timeout, malformed JSON — all the same to the caller
  }
}

/**
 * Rate to convert 1 unit of `currency` into EGP.
 *
 * EGP short-circuits at 1 — never spend a network call, and never let an API
 * outage stop a shipment that was priced in the local currency anyway.
 */
export async function egpRateFor(currency: string | null | undefined, now = new Date()): Promise<FxResult | null> {
  const cur = normalizeCurrency(currency);
  const today = now.toISOString().slice(0, 10);
  if (cur === 'EGP') return { rate: 1, date: today, stale: false };

  const cached = await readCache(cur);
  if (cached && isFreshQuote(cached.date, today)) return { rate: cached.rate, date: cached.date, stale: false };

  const live = await fetchLive(cur);
  if (live) {
    await writeCache(cur, live, now);
    return { ...live, stale: false };
  }

  // Provider unreachable. Yesterday's rate on a flagged lot beats blocking Ops.
  if (cached) return { rate: cached.rate, date: cached.date, stale: true };
  return null;
}

/** Resolve every currency a shipment uses in one pass, before any transaction opens. */
export async function egpRatesFor(currencies: Iterable<string | null | undefined>, now = new Date()): Promise<Map<string, FxResult>> {
  const out = new Map<string, FxResult>();
  for (const c of new Set([...currencies].map(normalizeCurrency))) {
    const r = await egpRateFor(c, now);
    if (r) out.set(c, r);
  }
  return out;
}
