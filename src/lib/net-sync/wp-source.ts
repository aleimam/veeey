/**
 * veeey.net catalog sync — SOURCE reader (egyptvitamins.net WordPress + ATUM + WPML).
 *
 * DB-DIRECT and READ-ONLY. Both databases live on the same box, so this reads the
 * WordPress MariaDB over localhost. Never writes to the source here (the only write
 * to WP is the Phase-3 stock decrement, which lives in its own module).
 *
 * Connection + table prefix come from env so this can NEVER run against the wrong DB:
 *   NET_SYNC_MYSQL_URL   mysql://user:pass@host:3306/egyptvit_website   (required)
 *   NET_SYNC_WP_PREFIX   table prefix (default 'SFPgx_')
 */
import mysql from 'mysql2/promise';
import type { RawProduct, RawLot, RawCategory } from './transform';

const PREFIX = process.env.NET_SYNC_WP_PREFIX || 'SFPgx_';
const T = (name: string) => `\`${PREFIX}${name}\``;

/** Chunk an id list so the `IN (...)` clauses stay a sane size. */
const chunk = <T>(arr: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

const toNum = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export async function createSourcePool(): Promise<mysql.Pool> {
  const url = process.env.NET_SYNC_MYSQL_URL;
  if (!url) throw new Error('NET_SYNC_MYSQL_URL is required (mysql://user:pass@host:3306/db) — refusing to run without an explicit source.');
  return mysql.createPool({ uri: url, connectionLimit: 4, dateStrings: false, namedPlaceholders: false });
}

type Row = mysql.RowDataPacket & Record<string, unknown>;

/** Read all EN published products with their AR overlay (WPML `trid`). */
async function readBase(pool: mysql.Pool): Promise<Map<number, RawProduct>> {
  const [rows] = await pool.query<Row[]>(
    `SELECT en.ID AS wpId, en.post_title AS nameEn, en.post_name AS slugEn,
            en.post_content AS longDescEn, en.post_excerpt AS shortDescEn,
            ar.post_title AS nameAr, ar.post_name AS slugAr,
            ar.post_content AS longDescAr, ar.post_excerpt AS shortDescAr
     FROM ${T('posts')} en
     JOIN ${T('icl_translations')} t
       ON t.element_id = en.ID AND t.element_type = 'post_product' AND t.language_code = 'en'
     LEFT JOIN ${T('icl_translations')} ta
       ON ta.trid = t.trid AND ta.language_code = 'ar'
     LEFT JOIN ${T('posts')} ar ON ar.ID = ta.element_id
     WHERE en.post_type = 'product' AND en.post_status = 'publish'`,
  );
  const map = new Map<number, RawProduct>();
  for (const r of rows) {
    const wpId = Number(r.wpId);
    map.set(wpId, {
      wpId,
      nameEn: String(r.nameEn ?? ''),
      slugEn: (r.slugEn as string) ?? null,
      longDescEn: (r.longDescEn as string) ?? null,
      shortDescEn: (r.shortDescEn as string) ?? null,
      nameAr: (r.nameAr as string) ?? null,
      slugAr: (r.slugAr as string) ?? null,
      longDescAr: (r.longDescAr as string) ?? null,
      shortDescAr: (r.shortDescAr as string) ?? null,
      legacySku: null,
      priceEgp: null,
      regularEgp: null,
      saleEgp: null,
      wcStock: null,
      brand: null,
      categories: [],
      lots: [],
    });
  }
  return map;
}

const META_KEYS = ['_sku', '_price', '_regular_price', '_sale_price', '_stock'] as const;

/** Attach WC native postmeta (sku, price fields, stock) to each product. */
async function attachPostmeta(pool: mysql.Pool, map: Map<number, RawProduct>): Promise<void> {
  const ids = [...map.keys()];
  for (const part of chunk(ids, 1000)) {
    const [rows] = await pool.query<Row[]>(
      `SELECT post_id, meta_key, meta_value FROM ${T('postmeta')}
       WHERE post_id IN (${part.map(() => '?').join(',')})
         AND meta_key IN (${META_KEYS.map(() => '?').join(',')})`,
      [...part, ...META_KEYS],
    );
    for (const r of rows) {
      const p = map.get(Number(r.post_id));
      if (!p) continue;
      const v = r.meta_value as string;
      switch (r.meta_key) {
        case '_sku': p.legacySku = v || null; break;
        case '_price': p.priceEgp = toNum(v); break;
        case '_regular_price': p.regularEgp = toNum(v); break;
        case '_sale_price': p.saleEgp = toNum(v); break;
        case '_stock': p.wcStock = toNum(v); break;
      }
    }
  }
}

/** Attach the pwb-brand term name (owner decision #7). One brand per product. */
async function attachBrand(pool: mysql.Pool, map: Map<number, RawProduct>): Promise<void> {
  const ids = [...map.keys()];
  for (const part of chunk(ids, 1000)) {
    const [rows] = await pool.query<Row[]>(
      `SELECT tr.object_id AS wpId, te.name AS brand
       FROM ${T('term_relationships')} tr
       JOIN ${T('term_taxonomy')} tt ON tt.term_taxonomy_id = tr.term_taxonomy_id AND tt.taxonomy = 'pwb-brand'
       JOIN ${T('terms')} te ON te.term_id = tt.term_id
       WHERE tr.object_id IN (${part.map(() => '?').join(',')})`,
      part,
    );
    for (const r of rows) {
      const p = map.get(Number(r.wpId));
      if (p && !p.brand) p.brand = String(r.brand ?? '') || null;
    }
  }
}

/** Attach product_cat terms (EN side; dedup by slug). */
async function attachCategories(pool: mysql.Pool, map: Map<number, RawProduct>): Promise<void> {
  const ids = [...map.keys()];
  for (const part of chunk(ids, 1000)) {
    const [rows] = await pool.query<Row[]>(
      `SELECT tr.object_id AS wpId, te.name AS nameEn, te.slug AS slug
       FROM ${T('term_relationships')} tr
       JOIN ${T('term_taxonomy')} tt ON tt.term_taxonomy_id = tr.term_taxonomy_id AND tt.taxonomy = 'product_cat'
       JOIN ${T('terms')} te ON te.term_id = tt.term_id
       WHERE tr.object_id IN (${part.map(() => '?').join(',')})`,
      part,
    );
    for (const r of rows) {
      const p = map.get(Number(r.wpId));
      if (!p) continue;
      const cat: RawCategory = { nameEn: String(r.nameEn ?? ''), slug: String(r.slug ?? '') };
      if (cat.slug && !p.categories.some((c) => c.slug === cat.slug)) p.categories.push(cat);
    }
  }
}

/** Attach ATUM inventories (lots) + their meta to each product. */
async function attachLots(pool: mysql.Pool, map: Map<number, RawProduct>): Promise<void> {
  const ids = [...map.keys()];
  for (const part of chunk(ids, 1000)) {
    const [rows] = await pool.query<Row[]>(
      `SELECT ai.product_id AS wpId, ai.id AS invId, ai.is_main AS isMain, ai.bbe_date AS bbe,
              m.stock_quantity AS metaStock, m.price AS metaPrice, m.regular_price AS metaRegular,
              m.sale_price AS metaSale, m.is_expired AS isExpired
       FROM ${T('atum_inventories')} ai
       LEFT JOIN ${T('atum_inventory_meta')} m ON m.inventory_id = ai.id
       WHERE ai.product_id IN (${part.map(() => '?').join(',')})`,
      part,
    );
    for (const r of rows) {
      const p = map.get(Number(r.wpId));
      if (!p) continue;
      const lot: RawLot = {
        invId: Number(r.invId),
        isMain: Number(r.isMain) === 1,
        bbe: r.bbe ? new Date(r.bbe as string) : null,
        metaStock: toNum(r.metaStock),
        metaPriceEgp: toNum(r.metaPrice),
        metaRegularEgp: toNum(r.metaRegular),
        metaSaleEgp: toNum(r.metaSale),
        isExpired: Number(r.isExpired) === 1,
      };
      p.lots.push(lot);
    }
  }
}

/** Read the full EN-published catalog as `RawProduct`s (idempotent, read-only). */
export async function readCatalog(pool: mysql.Pool): Promise<RawProduct[]> {
  const map = await readBase(pool);
  await attachPostmeta(pool, map);
  await attachBrand(pool, map);
  await attachCategories(pool, map);
  await attachLots(pool, map);
  return [...map.values()];
}
