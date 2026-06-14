import { prisma } from '@/lib/prisma';
import { notify } from '@/lib/notification-service';

/** Wishlist alerts (FR-WSH-02/03). Scan recent product-change events and fan out
 *  to wishlist items whose matching alert flag is on (preferences enforced in
 *  notify()). Idempotency in production is handled by the job runner; here it's
 *  windowed by time. */
export async function processProductChangeEvents(sinceMinutes = 60) {
  const since = new Date(Date.now() - sinceMinutes * 60_000);
  const events = await prisma.productChangeEvent.findMany({
    where: { createdAt: { gte: since }, type: { in: ['PRICE_DROP', 'SALE_LOT', 'BACK_IN_STOCK'] } },
    include: { product: { select: { id: true, nameEn: true } } },
  });

  let sent = 0;
  for (const ev of events) {
    const isStock = ev.type === 'BACK_IN_STOCK';
    const where = isStock
      ? { productId: ev.productId, notifyBackInStock: true }
      : { productId: ev.productId, notifyPriceDrop: true };
    const items = await prisma.wishlistItem.findMany({ where, include: { list: { select: { customerId: true } } } });

    for (const it of items) {
      await notify({
        customerId: it.list.customerId,
        type: isStock ? 'BACK_IN_STOCK' : 'PRICE_DROP',
        channel: 'PUSH',
        templateKey: isStock ? 'alert.back_in_stock' : 'alert.price_drop',
        vars: { product: ev.product.nameEn, price: ev.newValue ?? '' },
        refType: 'product',
        refId: ev.productId,
      });
      sent += 1;
    }
  }
  return { events: events.length, sent };
}
