/**
 * net-sync reviews — approved WP product reviews → Veeey Review (sync #3).
 * Read-only on WP; idempotent on Review.legacyId = `net-<comment id>`.
 *
 * AR-product reviews are remapped to the EN product via the WPML trid pair
 * (the Veeey catalog is keyed on the EN wpId). Reviews without a star rating
 * are skipped (Review.rating is required). Product ratingAvg/ratingCount are
 * recomputed for every touched product, mirroring the veeey.com WC import.
 */
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { prisma } from '@/lib/prisma';

const PREFIX = process.env.NET_SYNC_WP_PREFIX || 'SFPgx_';
const T = (n: string) => `\`${PREFIX}${n}\``;
type Row = RowDataPacket & Record<string, unknown>;

const stripHtml = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

export type RawReview = { commentId: number; enWpId: number; author: string | null; body: string | null; rating: number; createdAt: Date };

/** Approved product reviews with ratings, product ids normalized to the EN post. */
export async function readReviews(pool: Pool): Promise<RawReview[]> {
  const [rows] = await pool.query<Row[]>(
    `SELECT c.comment_ID AS id, c.comment_post_ID AS postId, c.comment_author AS author,
            c.comment_content AS body, c.comment_date_gmt AS createdAt, m.meta_value AS rating,
            COALESCE(en.element_id, c.comment_post_ID) AS enWpId
     FROM ${T('comments')} c
     JOIN ${T('posts')} p ON p.ID = c.comment_post_ID AND p.post_type = 'product'
     JOIN ${T('commentmeta')} m ON m.comment_id = c.comment_ID AND m.meta_key = 'rating'
     LEFT JOIN ${T('icl_translations')} own ON own.element_id = c.comment_post_ID AND own.element_type = 'post_product'
     LEFT JOIN ${T('icl_translations')} en ON en.trid = own.trid AND en.element_type = 'post_product' AND en.language_code = 'en'
     WHERE c.comment_approved = '1'`,
  );
  return rows
    .map((r) => ({
      commentId: Number(r.id),
      enWpId: Number(r.enWpId),
      author: r.author ? String(r.author).slice(0, 80) : null,
      body: stripHtml(String(r.body ?? '')).slice(0, 2000) || null,
      rating: Math.round(Number(r.rating)),
      createdAt: new Date(String(r.createdAt)),
    }))
    .filter((r) => Number.isFinite(r.rating) && r.rating >= 1 && r.rating <= 5);
}

export type ReviewsSummary = { source: number; created: number; skippedExisting: number; skippedNoProduct: number; productsRecomputed: number; errors: number };

export async function importReviews(pool: Pool, opts: { dryRun: boolean }): Promise<ReviewsSummary> {
  const s: ReviewsSummary = { source: 0, created: 0, skippedExisting: 0, skippedNoProduct: 0, productsRecomputed: 0, errors: 0 };
  const raws = await readReviews(pool);
  s.source = raws.length;

  const products = await prisma.product.findMany({ where: { legacyWpId: { in: [...new Set(raws.map((r) => r.enWpId))] } }, select: { id: true, legacyWpId: true } });
  const prodByWp = new Map(products.map((p) => [p.legacyWpId!, p.id]));
  const existing = new Set((await prisma.review.findMany({ where: { legacyId: { startsWith: 'net-' } }, select: { legacyId: true } })).map((r) => r.legacyId!));

  const touched = new Set<string>();
  for (const r of raws) {
    const legacyId = `net-${r.commentId}`;
    if (existing.has(legacyId)) { s.skippedExisting++; continue; }
    const productId = prodByWp.get(r.enWpId);
    if (!productId) { s.skippedNoProduct++; continue; }
    if (!opts.dryRun) {
      try {
        await prisma.review.create({
          data: { productId, authorName: r.author, rating: r.rating, body: r.body, status: 'APPROVED', source: 'IMPORT', legacyId, createdAt: r.createdAt },
        });
      } catch { s.errors++; continue; }
    }
    touched.add(productId);
    s.created++;
  }

  if (!opts.dryRun) {
    for (const productId of touched) {
      const agg = await prisma.review.aggregate({ where: { productId, status: 'APPROVED' }, _avg: { rating: true }, _count: true });
      await prisma.product.update({ where: { id: productId }, data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count } });
    }
  }
  s.productsRecomputed = touched.size;
  return s;
}
