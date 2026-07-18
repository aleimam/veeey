/**
 * veeey.net catalog sync — Phase 1b: copy WP product media onto veeey.net.
 *
 * Owner chose COPY over hotlink. Both sites are on the same box, so this is a
 * local file copy: WP `wp-content/uploads/<file>` → veeey.net `public/uploads/net/<file>`,
 * served by src/app/uploads/[...path]/route.ts at `/uploads/net/<file>`.
 *
 * Featured image (`_thumbnail_id`) becomes the primary ProductImage; the WooCommerce
 * gallery (`_product_image_gallery`) follows in order. Idempotent per product
 * (ProductImage rows are replaced each run). Runs on the box via tsx as root so it
 * can read the WP uploads and write veeey.net's public/uploads.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { prisma } from '@/lib/prisma';

const PREFIX = process.env.NET_SYNC_WP_PREFIX || 'SFPgx_';
const T = (name: string) => `\`${PREFIX}${name}\``;
type Row = RowDataPacket & Record<string, unknown>;

const chunk = <T>(arr: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

/** Parse a WooCommerce gallery meta value ("12,34,56") into numeric ids. PURE. */
export function parseGalleryIds(csv: string | null | undefined): number[] {
  return String(csv ?? '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

export type ProductImages = { featured: string | null; gallery: string[] };

/** For each product id: its featured file + ordered gallery files (uploads-relative). */
export async function readImageMap(pool: Pool, wpIds: number[]): Promise<Map<number, ProductImages>> {
  const map = new Map<number, ProductImages>();
  for (const id of wpIds) map.set(id, { featured: null, gallery: [] });

  for (const part of chunk(wpIds, 1000)) {
    const ph = part.map(() => '?').join(',');
    // Featured image: _thumbnail_id → attachment's _wp_attached_file.
    const [feat] = await pool.query<Row[]>(
      `SELECT tn.post_id AS wpId, af.meta_value AS file
       FROM ${T('postmeta')} tn
       JOIN ${T('postmeta')} af ON af.post_id = tn.meta_value AND af.meta_key = '_wp_attached_file'
       WHERE tn.meta_key = '_thumbnail_id' AND tn.post_id IN (${ph})`,
      part,
    );
    for (const r of feat) {
      const p = map.get(Number(r.wpId));
      if (p && r.file) p.featured = String(r.file);
    }

    // Gallery: _product_image_gallery (CSV of attachment ids) → resolve each file.
    const [gal] = await pool.query<Row[]>(
      `SELECT post_id AS wpId, meta_value AS csv FROM ${T('postmeta')}
       WHERE meta_key = '_product_image_gallery' AND post_id IN (${ph})`,
      part,
    );
    const wantAtt = new Set<number>();
    const galByProduct = new Map<number, number[]>();
    for (const r of gal) {
      const ids = parseGalleryIds(r.csv as string);
      if (ids.length) { galByProduct.set(Number(r.wpId), ids); ids.forEach((a) => wantAtt.add(a)); }
    }
    if (wantAtt.size) {
      const attIds = [...wantAtt];
      const fileByAtt = new Map<number, string>();
      for (const attPart of chunk(attIds, 1000)) {
        const [files] = await pool.query<Row[]>(
          `SELECT post_id AS attId, meta_value AS file FROM ${T('postmeta')}
           WHERE meta_key = '_wp_attached_file' AND post_id IN (${attPart.map(() => '?').join(',')})`,
          attPart,
        );
        for (const r of files) if (r.file) fileByAtt.set(Number(r.attId), String(r.file));
      }
      for (const [wpId, ids] of galByProduct) {
        const p = map.get(wpId);
        if (!p) continue;
        for (const a of ids) {
          const f = fileByAtt.get(a);
          if (f && f !== p.featured) p.gallery.push(f);
        }
      }
    }
  }
  return map;
}

export type ImageSummary = {
  productsSeen: number;
  productsWithImages: number;
  filesCopied: number;
  filesMissing: number;
  imageRowsWritten: number;
  errors: { wpId: number; detail: string }[];
};

async function copyOne(srcDir: string, destDir: string, rel: string, dryRun: boolean): Promise<boolean> {
  const src = path.join(srcDir, rel);
  try { await fs.access(src); } catch { return false; }
  if (!dryRun) {
    const dest = path.join(destDir, rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);
  }
  return true;
}

/** Copy media for every imported product and (re)write its ProductImage rows. */
export async function syncImages(
  pool: Pool,
  opts: { srcDir: string; destDir: string; urlBase?: string; dryRun: boolean; onProgress?: (n: number, total: number) => void },
): Promise<ImageSummary> {
  const urlBase = (opts.urlBase ?? '/uploads/net').replace(/\/$/, '');
  const s: ImageSummary = { productsSeen: 0, productsWithImages: 0, filesCopied: 0, filesMissing: 0, imageRowsWritten: 0, errors: [] };

  const products = await prisma.product.findMany({ where: { legacyWpId: { not: null } }, select: { id: true, legacyWpId: true, nameEn: true } });
  const wpIds = products.map((p) => p.legacyWpId!) as number[];
  const imgMap = await readImageMap(pool, wpIds);

  let i = 0;
  for (const p of products) {
    s.productsSeen++;
    const imgs = imgMap.get(p.legacyWpId!);
    const files: { rel: string; primary: boolean }[] = [];
    if (imgs?.featured) files.push({ rel: imgs.featured, primary: true });
    for (const g of imgs?.gallery ?? []) files.push({ rel: g, primary: false });

    if (files.length) {
      try {
        const rows: { productId: string; url: string; alt: string; sortOrder: number; isPrimary: boolean }[] = [];
        let sort = 0;
        for (const f of files) {
          const ok = await copyOne(opts.srcDir, opts.destDir, f.rel, opts.dryRun);
          if (ok) s.filesCopied++; else { s.filesMissing++; continue; }
          rows.push({ productId: p.id, url: `${urlBase}/${f.rel}`, alt: p.nameEn, sortOrder: sort++, isPrimary: f.primary && sort === 1 });
        }
        if (rows.length) {
          s.productsWithImages++;
          s.imageRowsWritten += rows.length;
          if (!opts.dryRun) {
            await prisma.productImage.deleteMany({ where: { productId: p.id } });
            await prisma.productImage.createMany({ data: rows });
          }
        }
      } catch (e) {
        s.errors.push({ wpId: p.legacyWpId!, detail: e instanceof Error ? e.message : String(e) });
      }
    }
    if (++i % 200 === 0) opts.onProgress?.(i, products.length);
  }
  opts.onProgress?.(products.length, products.length);
  return s;
}
