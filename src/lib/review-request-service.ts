import { prisma } from '@/lib/prisma';
import { getSetting } from '@/lib/settings-service';
import { QUEUES, getBoss } from '@/lib/jobs';
import { notify } from '@/lib/notification-service';

/**
 * Post-delivery review requests (#188). When an order is delivered, schedule a
 * one-off job for `reviews.requestDelayDays` days later; the job emails the
 * customer a request to review the products they haven't reviewed yet. Order-level
 * dedupe via Order.reviewRequestSentAt (set on the first attempt, so a customer
 * is never asked twice for the same order).
 */

const SITE = 'https://veeey.com';

/** Queue a delayed review request for a just-delivered order (best-effort). */
export async function scheduleReviewRequest(orderId: string): Promise<void> {
  if ((await getSetting('reviews.requestEnabled')).toLowerCase() !== 'true') return;
  const days = Number(await getSetting('reviews.requestDelayDays')) || 7;
  const boss = await getBoss();
  if (!boss) return; // no queue in this environment → skip (background nicety)
  await boss.send(QUEUES.reviewRequest, { orderId }, { startAfter: days * 24 * 60 * 60 });
}

/** Job body: email the customer a review request for their un-reviewed products. */
export async function sendReviewRequest(orderId: string): Promise<{ sent: boolean; reason?: string }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      number: true,
      reviewRequestSentAt: true,
      customerId: true,
      customer: { select: { nameAr: true, user: { select: { email: true, name: true } } } },
      items: { where: { isGift: false, lost: false }, select: { productId: true, product: { select: { slugEn: true, nameEn: true } } } },
    },
  });
  if (!order || !order.customerId || order.status !== 'DELIVERED' || order.reviewRequestSentAt) {
    return { sent: false, reason: 'skip' };
  }

  const products = new Map<string, { slug: string; nameEn: string }>();
  for (const it of order.items) if (!products.has(it.productId)) products.set(it.productId, { slug: it.product.slugEn, nameEn: it.product.nameEn });
  const productIds = [...products.keys()];
  const reviewed = new Set(
    (await prisma.review.findMany({ where: { customerId: order.customerId, productId: { in: productIds } }, select: { productId: true } })).map((r) => r.productId),
  );
  const pending = productIds.filter((id) => !reviewed.has(id));

  // Mark first (dedupe) so a failure or an all-reviewed order is never retried.
  await prisma.order.update({ where: { id: orderId }, data: { reviewRequestSentAt: new Date() } });
  if (pending.length === 0) return { sent: false, reason: 'all_reviewed' };

  const email = order.customer?.user.email ?? null;
  if (!email) return { sent: false, reason: 'no_email' };

  const first = products.get(pending[0])!;
  const names = pending.map((id) => products.get(id)!.nameEn).join(', ');
  await notify({
    customerId: order.customerId,
    toAddress: email,
    type: 'ORDER',
    channel: 'EMAIL',
    templateKey: 'review.request',
    vars: { name: order.customer?.user.name ?? 'there', number: order.number, products: names, link: `${SITE}/en/products/${first.slug}#reviews` },
    refType: 'order',
    refId: orderId,
    locale: 'en',
  });
  return { sent: true };
}
