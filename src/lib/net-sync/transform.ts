/**
 * veeey.net catalog sync — PURE transform (egyptvitamins.net WP/ATUM/WPML → Veeey).
 *
 * No DB / network imports here so it stays unit-testable. The source reader
 * (`wp-source.ts`) produces `RawProduct`s; the importer (`importer.ts`) consumes
 * `PlannedProduct`s. Owner-locked rules (see `VEEEY_NET_MIGRATION.md`):
 *  - EN is the source of truth; AR is an overlay (empty AR → storefront falls back to EN).
 *  - One Veeey Lot per ATUM inventory: expiry = `bbe_date` (null → non-perishable),
 *    past `bbe` (or ATUM `is_expired`) → an EXPIRED lot kept for history.
 *  - MAIN inventory's stock/price come from WC native postmeta; EXTRA inventories
 *    from the ATUM meta table.
 *  - Prices are EGP major units on the source → integer piastres on Veeey.
 *  - Products go live directly (owner decision) → status PUBLISHED.
 */
import { skuFromParts, brandCode, slugify } from '@/lib/sku';
import { egpToPiastres } from '@/lib/format';

export type RawLot = {
  invId: number;
  isMain: boolean;
  bbe: Date | null;
  /** Extra-inventory fields (null for the main inventory — read WC postmeta instead). */
  metaStock: number | null;
  metaPriceEgp: number | null;
  metaRegularEgp: number | null;
  metaSaleEgp: number | null;
  isExpired: boolean;
};

export type RawCategory = { nameEn: string; slug: string };

export type RawProduct = {
  wpId: number;
  nameEn: string;
  slugEn: string | null;
  longDescEn: string | null;
  shortDescEn: string | null;
  nameAr: string | null;
  slugAr: string | null;
  longDescAr: string | null;
  shortDescAr: string | null;
  legacySku: string | null; // WC _sku (numeric = wp id on this source)
  priceEgp: number | null; // WC _price
  regularEgp: number | null; // WC _regular_price
  saleEgp: number | null; // WC _sale_price
  wcStock: number | null; // WC _stock (the main inventory's stock)
  brand: string | null; // pwb-brand term name
  categories: RawCategory[];
  lots: RawLot[]; // ATUM inventories (may be empty)
};

export type PlannedLot = {
  expiryDate: Date | null;
  qtyOnHand: number;
  priceOverridePiastres: bigint | null; // set only when the lot price differs from base
  status: 'LIVE' | 'EXPIRED';
};

export type PlannedProduct = {
  wpId: number;
  sku: string;
  legacySku: string | null;
  brandName: string | null;
  nameEn: string;
  nameAr: string | null;
  slugEn: string;
  slugAr: string | null;
  shortDescEn: string | null;
  shortDescAr: string | null;
  longDescEn: string | null;
  longDescAr: string | null;
  basePricePiastres: bigint;
  categories: RawCategory[];
  lots: PlannedLot[];
  /** Report-only signals (not persisted). */
  flags: { noPrice: boolean; noLiveStock: boolean; syntheticLot: boolean };
};

/** Decode the handful of HTML entities WordPress leaves in post titles/terms. */
export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#8217;/g, '’')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

const clean = (v: string | null | undefined): string | null => {
  const s = (v ?? '').trim();
  return s ? decodeEntities(s) : null;
};

/** First non-null EGP amount in preference order (sale wins when on sale). */
const pickEgp = (...vals: (number | null | undefined)[]): number | null => {
  for (const v of vals) if (v != null && Number.isFinite(v)) return v;
  return null;
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function planLot(lot: RawLot, r: RawProduct, baseEgp: number | null, now: Date): PlannedLot {
  // Main inventory → WC native stock/price; extra inventory → ATUM meta table.
  const stockRaw = lot.isMain ? r.wcStock : lot.metaStock;
  const lotEgp = lot.isMain
    ? pickEgp(r.saleEgp, r.priceEgp, r.regularEgp)
    : pickEgp(lot.metaSaleEgp, lot.metaPriceEgp, lot.metaRegularEgp);
  const expired = lot.isExpired || (lot.bbe != null && lot.bbe < startOfDay(now));
  const basePiastres = baseEgp != null ? egpToPiastres(baseEgp) : 0n;
  const lotPiastres = lotEgp != null ? egpToPiastres(lotEgp) : null;
  return {
    expiryDate: lot.bbe,
    qtyOnHand: Math.max(0, Math.round(stockRaw ?? 0)),
    // price-per-expiry: only record an override when it actually differs from base
    priceOverridePiastres: lotPiastres != null && lotPiastres !== basePiastres ? lotPiastres : null,
    status: expired ? 'EXPIRED' : 'LIVE',
  };
}

/** Transform one raw source product into the Veeey shape (pure). */
export function planProduct(r: RawProduct, now: Date = new Date()): PlannedProduct {
  const brandName = clean(r.brand);
  const nameEn = clean(r.nameEn) || `Product ${r.wpId}`;
  const baseEgp = pickEgp(r.saleEgp, r.priceEgp, r.regularEgp);

  // Idempotent Veeey SKU derived from brand + the stable WP id.
  const sku = skuFromParts(brandCode(brandName || 'GEN'), r.wpId);

  // One product with no ATUM inventory → a synthetic main lot from WC stock.
  const rawLots: RawLot[] = r.lots.length
    ? r.lots
    : [{ invId: -r.wpId, isMain: true, bbe: null, metaStock: null, metaPriceEgp: null, metaRegularEgp: null, metaSaleEgp: null, isExpired: false }];
  const lots = rawLots.map((l) => planLot(l, r, baseEgp, now));

  const slugEn = slugify(r.slugEn || nameEn) || `product-${r.wpId}`;
  const nameAr = clean(r.nameAr);
  const slugAr = r.slugAr ? slugify(r.slugAr) || null : nameAr ? slugify(nameAr) || null : null;

  return {
    wpId: r.wpId,
    sku,
    legacySku: clean(r.legacySku),
    brandName,
    nameEn,
    nameAr,
    slugEn,
    slugAr,
    shortDescEn: clean(r.shortDescEn),
    shortDescAr: clean(r.shortDescAr),
    // descriptions are HTML — keep as-is (sanitized on render), just trim empties
    longDescEn: (r.longDescEn ?? '').trim() || null,
    longDescAr: (r.longDescAr ?? '').trim() || null,
    basePricePiastres: baseEgp != null ? egpToPiastres(baseEgp) : 0n,
    categories: r.categories,
    lots,
    flags: {
      noPrice: baseEgp == null,
      noLiveStock: !lots.some((l) => l.status === 'LIVE' && l.qtyOnHand > 0),
      syntheticLot: r.lots.length === 0,
    },
  };
}
