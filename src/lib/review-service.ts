import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission, getCurrentUser } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { summarizeReviews } from '@/lib/ai';
import type { Prisma } from '@/generated/prisma/client';

/** Reviews (FR-REV-*): customer submission with photos/videos, moderation, and
 *  an AI-generated summary cached on the product. */

const reviewSchema = z.object({
  productId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().max(2000).optional(),
  media: z.array(z.string().url()).max(6).optional(),
});
export type ReviewInput = z.input<typeof reviewSchema>;

export async function submitReview(raw: ReviewInput) {
  const data = reviewSchema.parse(raw);
  const user = await getCurrentUser();
  // Verified purchase = the signed-in reviewer has a non-cancelled order line
  // for this product (audit P1 5.1 — verified badges).
  const verifiedPurchase = user?.customerId
    ? (await prisma.orderItem.count({
        where: { productId: data.productId, order: { customerId: user.customerId, status: { notIn: ['CANCELLED', 'REFUNDED'] } } },
      })) > 0
    : false;
  return prisma.review.create({
    data: {
      productId: data.productId,
      customerId: user?.customerId ?? null,
      authorName: user?.name ?? 'Veeey customer',
      rating: data.rating,
      title: data.title ?? null,
      body: data.body ?? null,
      status: 'PENDING',
      verifiedPurchase,
      media: data.media && data.media.length ? { create: data.media.map((url) => ({ url, type: 'IMAGE' as const })) } : undefined,
    },
  });
}

export const listReviews = ({ status, rating, q }: { status?: string; rating?: string; q?: string } = {}) => {
  const where: Prisma.ReviewWhereInput = {};
  if (status) where.status = status as Prisma.ReviewWhereInput['status'];
  const ratingNum = Number(rating);
  if (rating && !Number.isNaN(ratingNum)) where.rating = ratingNum;
  if (q) where.OR = [{ body: { contains: q, mode: 'insensitive' } }, { authorName: { contains: q, mode: 'insensitive' } }];
  return prisma.review.findMany({
    where,
    include: { product: { select: { id: true, nameEn: true, slugEn: true } }, media: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
};

export const getReview = (id: string) => prisma.review.findUnique({ where: { id }, include: { product: true, media: true } });

export async function recomputeRating(productId: string) {
  const agg = await prisma.review.aggregate({ where: { productId, status: 'APPROVED' }, _avg: { rating: true }, _count: true });
  await prisma.product.update({ where: { id: productId }, data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count } });
}

export async function moderateReview(id: string, status: 'APPROVED' | 'REJECTED') {
  const user = await requirePermission('reviews.moderate');
  const review = await prisma.review.update({ where: { id }, data: { status, moderatorId: user.id } });
  if (status === 'APPROVED') await recomputeRating(review.productId);
  await audit({ actorType: 'USER', actorId: user.id, action: `review.${status.toLowerCase()}`, entityType: 'Review', entityId: id });
  return review;
}

/** Regenerate the cached AI review summary for a product (env-gated; no-op without a key). */
export async function regenerateReviewSummary(productId: string) {
  const user = await requirePermission('reviews.moderate');
  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
  const reviews = await prisma.review.findMany({ where: { productId, status: 'APPROVED', NOT: { body: null } }, select: { rating: true, body: true } });
  const summary = await summarizeReviews(product.nameEn, reviews.map((r) => ({ rating: r.rating, body: r.body ?? '' })));
  if (summary) await prisma.product.update({ where: { id: productId }, data: { aiReviewSummary: summary, aiReviewSummaryAt: new Date() } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'review.summarize', entityType: 'Product', entityId: productId, data: { generated: !!summary } });
  return summary;
}
