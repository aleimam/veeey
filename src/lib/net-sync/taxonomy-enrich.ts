/**
 * net-sync enrichment — product TAGS + ATTRIBUTES from egyptvitamins.net
 * (owner sync item #1). Read-only on WP; idempotent on veeey.net.
 *
 *  - product_tag → Veeey Tag (slug-keyed, EN base + WPML AR overlay) + product links.
 *  - pa_* taxonomies (except pa_brand — brands came in Phase 1) → Attribute
 *    (key = taxonomy minus `pa_`) + AttributeValue (per-attribute by valueEn,
 *    AR overlay, slug) + ProductAttributeValue links. New attributes are
 *    created MULTI_SELECT + filterable (drives PLP facets); existing ones are
 *    never reconfigured — admin edits win.
 *  - Product links are REPLACED per run for synced taxonomies only (WP is the
 *    master for this catalog; manual veeey.net-side links to OTHER attributes
 *    are untouched).
 */
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/sku';
import { decodeEntities } from './transform';

const PREFIX = process.env.NET_SYNC_WP_PREFIX || 'SFPgx_';
const T = (n: string) => `\`${PREFIX}${n}\``;
type Row = RowDataPacket & Record<string, unknown>;

export type RawTermLink = { wpId: number; taxonomy: string; ttId: number; name: string; slug: string };

/** Humanize a pa_ taxonomy into an attribute display name. PURE. */
export function attributeNameFor(taxonomy: string): string {
  const base = taxonomy.replace(/^pa_/, '');
  const special: Record<string, string> = { conc: 'Concentration', unit: 'Unit', 'age-gender': 'Age / Gender' };
  if (special[base]) return special[base];
  return base.split('-').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
}

/** Term links (EN or untranslated terms only) for EN published products. */
export async function readTermLinks(pool: Pool): Promise<RawTermLink[]> {
  const [rows] = await pool.query<Row[]>(
    `SELECT tr.object_id AS wpId, tt.taxonomy, tt.term_taxonomy_id AS ttId, t.name, t.slug
     FROM ${T('term_relationships')} tr
     JOIN ${T('term_taxonomy')} tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
     JOIN ${T('terms')} t ON t.term_id = tt.term_id
     JOIN ${T('posts')} p ON p.ID = tr.object_id AND p.post_type = 'product' AND p.post_status = 'publish'
     JOIN ${T('icl_translations')} ic ON ic.element_id = p.ID AND ic.element_type = 'post_product' AND ic.language_code = 'en'
     LEFT JOIN ${T('icl_translations')} tic ON tic.element_id = tt.term_taxonomy_id AND tic.element_type = CONCAT('tax_', tt.taxonomy)
     WHERE (tt.taxonomy = 'product_tag' OR (tt.taxonomy LIKE 'pa_%' AND tt.taxonomy <> 'pa_brand'))
       AND (tic.language_code IS NULL OR tic.language_code = 'en')`,
  );
  return rows.map((r) => ({ wpId: Number(r.wpId), taxonomy: String(r.taxonomy), ttId: Number(r.ttId), name: decodeEntities(String(r.name)), slug: String(r.slug) }));
}

/** EN term_taxonomy_id → Arabic term name (WPML trid pairing). */
export async function readTermArNames(pool: Pool): Promise<Map<number, string>> {
  const [rows] = await pool.query<Row[]>(
    `SELECT en.element_id AS enTt, t2.name AS arName
     FROM ${T('icl_translations')} en
     JOIN ${T('icl_translations')} ar ON ar.trid = en.trid AND ar.language_code = 'ar' AND ar.element_type = en.element_type
     JOIN ${T('term_taxonomy')} tt2 ON tt2.term_taxonomy_id = ar.element_id
     JOIN ${T('terms')} t2 ON t2.term_id = tt2.term_id
     WHERE en.language_code = 'en' AND (en.element_type = 'tax_product_tag' OR en.element_type LIKE 'tax_pa_%')`,
  );
  const m = new Map<number, string>();
  for (const r of rows) m.set(Number(r.enTt), decodeEntities(String(r.arName)));
  return m;
}

export type EnrichSummary = {
  productsTouched: number;
  tagsCreated: number; tagLinks: number;
  attributesCreated: number; valuesCreated: number; attrLinks: number;
  errors: { wpId: number; detail: string }[];
};

/** Apply tags + attributes to the imported catalog. Re-runnable. */
export async function enrichCatalog(pool: Pool, opts: { dryRun: boolean; onProgress?: (n: number, total: number) => void }): Promise<EnrichSummary> {
  const s: EnrichSummary = { productsTouched: 0, tagsCreated: 0, tagLinks: 0, attributesCreated: 0, valuesCreated: 0, attrLinks: 0, errors: [] };
  const [links, arNames] = await Promise.all([readTermLinks(pool), readTermArNames(pool)]);

  // Group links per product / class.
  const byProduct = new Map<number, { tags: RawTermLink[]; attrs: RawTermLink[] }>();
  for (const l of links) {
    let e = byProduct.get(l.wpId);
    if (!e) { e = { tags: [], attrs: [] }; byProduct.set(l.wpId, e); }
    (l.taxonomy === 'product_tag' ? e.tags : e.attrs).push(l);
  }

  // ---- Tags: ensure Tag rows for every distinct term slug.
  const tagBySlug = new Map((await prisma.tag.findMany({ select: { id: true, slug: true } })).map((t) => [t.slug, t.id]));
  const wantTags = new Map<string, RawTermLink>();
  for (const l of links) if (l.taxonomy === 'product_tag') wantTags.set(slugify(l.slug) || slugify(l.name), l);
  for (const [slug, l] of wantTags) {
    if (!slug || tagBySlug.has(slug)) continue;
    if (!opts.dryRun) {
      const t = await prisma.tag.create({ data: { slug, nameEn: l.name, nameAr: arNames.get(l.ttId) ?? null } });
      tagBySlug.set(slug, t.id);
    } else tagBySlug.set(slug, `dry-${slug}`);
    s.tagsCreated++;
  }

  // ---- Attributes: ensure Attribute per taxonomy (match by key, then nameEn).
  const taxonomies = [...new Set(links.filter((l) => l.taxonomy !== 'product_tag').map((l) => l.taxonomy))];
  const existingAttrs = await prisma.attribute.findMany({ select: { id: true, key: true, nameEn: true } });
  const attrIdByTax = new Map<string, string>();
  for (const tax of taxonomies) {
    const key = tax.replace(/^pa_/, '');
    const name = attributeNameFor(tax);
    const hit = existingAttrs.find((a) => a.key === key) ?? existingAttrs.find((a) => a.nameEn.toLowerCase() === name.toLowerCase());
    if (hit) { attrIdByTax.set(tax, hit.id); continue; }
    if (!opts.dryRun) {
      const a = await prisma.attribute.create({ data: { key, nameEn: name, inputType: 'MULTI_SELECT', isFilterable: true } });
      attrIdByTax.set(tax, a.id);
    } else attrIdByTax.set(tax, `dry-${key}`);
    s.attributesCreated++;
  }

  // ---- Attribute values: ensure per (attribute, valueEn).
  const valueId = new Map<string, string>(); // `${attrId}|${valueEn}` → id
  if (!opts.dryRun) {
    for (const v of await prisma.attributeValue.findMany({ where: { attributeId: { in: [...attrIdByTax.values()] } }, select: { id: true, attributeId: true, valueEn: true } })) {
      valueId.set(`${v.attributeId}|${v.valueEn}`, v.id);
    }
  }
  const wantValues = new Map<string, RawTermLink>();
  for (const l of links) {
    if (l.taxonomy === 'product_tag') continue;
    wantValues.set(`${attrIdByTax.get(l.taxonomy)}|${l.name}`, l);
  }
  for (const [k, l] of wantValues) {
    if (valueId.has(k)) continue;
    const attributeId = attrIdByTax.get(l.taxonomy)!;
    if (!opts.dryRun) {
      const v = await prisma.attributeValue.create({ data: { attributeId, valueEn: l.name, valueAr: arNames.get(l.ttId) ?? null, slug: slugify(l.slug) || null } });
      valueId.set(k, v.id);
    } else valueId.set(k, `dry-${k}`);
    s.valuesCreated++;
  }

  // ---- Per-product links (products matched by legacyWpId).
  const products = await prisma.product.findMany({ where: { legacyWpId: { in: [...byProduct.keys()] } }, select: { id: true, legacyWpId: true } });
  const prodByWp = new Map(products.map((p) => [p.legacyWpId!, p.id]));
  const syncedAttrIds = [...attrIdByTax.values()];
  let i = 0;
  for (const [wpId, e] of byProduct) {
    const productId = prodByWp.get(wpId);
    if (!productId) continue;
    try {
      const tagIds = [...new Set(e.tags.map((l) => tagBySlug.get(slugify(l.slug) || slugify(l.name))).filter((x): x is string => !!x))];
      const valIds = [...new Set(e.attrs.map((l) => valueId.get(`${attrIdByTax.get(l.taxonomy)}|${l.name}`)).filter((x): x is string => !!x))];
      if (!opts.dryRun) {
        await prisma.product.update({ where: { id: productId }, data: { tags: { set: tagIds.map((id) => ({ id })) } } });
        // Replace links for the SYNCED attributes only; other attributes untouched.
        await prisma.productAttributeValue.deleteMany({ where: { productId, attributeValue: { attributeId: { in: syncedAttrIds } } } });
        if (valIds.length) await prisma.productAttributeValue.createMany({ data: valIds.map((attributeValueId) => ({ productId, attributeValueId })), skipDuplicates: true });
      }
      s.productsTouched++;
      s.tagLinks += tagIds.length;
      s.attrLinks += valIds.length;
    } catch (err) {
      s.errors.push({ wpId, detail: err instanceof Error ? err.message : String(err) });
    }
    if (++i % 250 === 0) opts.onProgress?.(i, byProduct.size);
  }
  opts.onProgress?.(byProduct.size, byProduct.size);
  return s;
}
