import type { Prisma } from '@/generated/prisma/client';

/**
 * PLP faceted filtering (audit P1 5.5). Pure parse/compose helpers so the
 * filter grammar is unit-testable: category (health goal), brand, kind,
 * price range (EGP), minimum rating, expiry window (ties into the
 * near-dated-deal model), dynamic attribute facets (form, dietary, …),
 * in-stock / on-offer, sort. URL params are flat and shareable.
 */

export type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export type ExpWindow = 'lt3' | '3to6' | 'gt6';

export type PlpState = {
  q?: string;
  brand?: string;
  category?: string;
  kind?: string;
  sort: string;
  instock: boolean;
  offers: boolean;
  pminEgp?: number;
  pmaxEgp?: number;
  rating?: number;
  exp?: ExpWindow;
  attrs: Record<string, string>; // attributeId → attributeValueId (av_<id> params)
};

export function parsePlp(sp: SP): PlpState {
  const num = (k: string) => {
    const n = Number(one(sp[k]));
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  const attrs: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (k.startsWith('av_')) {
      const val = one(v);
      if (val) attrs[k.slice(3)] = val;
    }
  }
  const ratingRaw = Number(one(sp.rating));
  const expRaw = one(sp.exp);
  return {
    q: one(sp.q)?.trim() || undefined,
    brand: one(sp.brand) || undefined,
    category: one(sp.category) || undefined,
    kind: one(sp.kind) || undefined,
    sort: one(sp.sort) || 'popular',
    instock: one(sp.instock) === '1',
    offers: one(sp.offers) === '1',
    pminEgp: num('pmin'),
    pmaxEgp: num('pmax'),
    rating: Number.isInteger(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5 ? ratingRaw : undefined,
    exp: expRaw === 'lt3' || expRaw === '3to6' || expRaw === 'gt6' ? expRaw : undefined,
    attrs,
  };
}

/**
 * Product where-fragment for the parsed facets (q/status/visibility are the
 * page's concern). Lot-based facets (stock, offers, expiry window) AND
 * together instead of overwriting one another.
 */
export function plpWhere(s: PlpState, now = new Date()): Prisma.ProductWhereInput {
  const day = (n: number) => new Date(now.getTime() + n * 86_400_000);
  const liveLot = { status: 'LIVE' as const, qtyOnHand: { gt: 0 } };
  const ands: Prisma.ProductWhereInput[] = [];
  if (s.instock) ands.push({ lots: { some: liveLot } });
  if (s.offers) ands.push({ lots: { some: { saleFlag: true } } });
  if (s.exp === 'lt3') ands.push({ lots: { some: { ...liveLot, expiryDate: { gt: now, lte: day(90) } } } });
  if (s.exp === '3to6') ands.push({ lots: { some: { ...liveLot, expiryDate: { gt: day(90), lte: day(180) } } } });
  if (s.exp === 'gt6') ands.push({ lots: { some: { ...liveLot, OR: [{ expiryDate: { gt: day(180) } }, { expiryDate: null }] } } });
  for (const valueId of Object.values(s.attrs)) {
    ands.push({ attributeValues: { some: { attributeValueId: valueId } } });
  }
  return {
    ...(s.brand ? { brandId: s.brand } : {}),
    ...(s.category ? { categories: { some: { id: s.category } } } : {}),
    ...(s.kind ? { kind: s.kind as Prisma.ProductWhereInput['kind'] } : {}),
    ...(s.pminEgp != null || s.pmaxEgp != null
      ? {
          basePricePiastres: {
            ...(s.pminEgp != null ? { gte: BigInt(Math.round(s.pminEgp * 100)) } : {}),
            ...(s.pmaxEgp != null ? { lte: BigInt(Math.round(s.pmaxEgp * 100)) } : {}),
          },
        }
      : {}),
    ...(s.rating != null ? { ratingAvg: { gte: s.rating }, ratingCount: { gt: 0 } } : {}),
    ...(ands.length ? { AND: ands } : {}),
  };
}

/** Href that drops the given params — powers the removable filter chips. */
export function removeParamHref(base: string, sp: SP, keys: string[]): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (keys.includes(k)) continue;
    const val = one(v);
    if (val) params.set(k, val);
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
