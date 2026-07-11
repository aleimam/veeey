import { prisma } from '@/lib/prisma';
import { notify } from '@/lib/notification-service';
import { getSetting } from '@/lib/settings-service';
import { alertVars, alertKind, alertDedupeKey, formatAlertPrice, type AlertEvent } from '@/lib/alert-plan';

/**
 * Wishlist alerts (FR-WSH-02/03). Consume pending product-change events
 * (exactly-once via processedAt — marked BEFORE sending so a failure can never
 * re-spam) and fan out to wishlist items whose matching alert flag is on:
 * EMAIL in the customer's locale with a product deep link (gated by the
 * alerts.wishlistEmailEnabled setting + needs SMTP) plus the existing PUSH.
 * Per-customer preferences are enforced inside notify().
 */

/** Record a PRICE_DROP event when a product's base price is lowered (admin
 *  edit, bulk price tool, or an applied AI proposal). Values are EGP strings.
 *  Best-effort — never throws into the write path. */
export async function recordPriceDropIfLower(productId: string, oldPiastres: bigint, newPiastres: bigint): Promise<void> {
  if (newPiastres >= oldPiastres) return;
  try {
    await prisma.productChangeEvent.create({
      data: {
        productId,
        type: 'PRICE_DROP',
        oldValue: (Number(oldPiastres) / 100).toString(),
        newValue: (Number(newPiastres) / 100).toString(),
      },
    });
  } catch (e) {
    console.error('recordPriceDropIfLower failed', e);
  }
}

export async function processProductChangeEvents(batch = 200) {
  const events = await prisma.productChangeEvent.findMany({
    where: { processedAt: null, type: { in: ['PRICE_DROP', 'SALE_LOT', 'BACK_IN_STOCK'] } },
    include: { product: { select: { id: true, nameEn: true, nameAr: true, slugEn: true, slugAr: true, status: true } } },
    orderBy: { createdAt: 'asc' },
    take: batch,
  });
  if (events.length === 0) return { events: 0, sent: 0 };

  // Mark consumed up front — a dispatch failure must not re-alert next sweep.
  await prisma.productChangeEvent.updateMany({ where: { id: { in: events.map((e) => e.id) } }, data: { processedAt: new Date() } });

  const emailEnabled = (await getSetting('alerts.wishlistEmailEnabled')).toLowerCase() === 'true';
  const seen = new Set<string>(); // customer × product × kind, per sweep
  let sent = 0;

  for (const ev of events) {
    if (ev.product.status !== 'PUBLISHED') continue; // never alert into a hidden PDP
    const evType = ev.type as AlertEvent['type']; // query filters to the 3 alert types
    const isStock = alertKind(evType) === 'stock';
    const items = await prisma.wishlistItem.findMany({
      where: { productId: ev.productId, ...(isStock ? { notifyBackInStock: true } : { notifyPriceDrop: true }) },
      include: { list: { select: { customer: { select: { id: true, locale: true, user: { select: { email: true } } } } } } },
    });

    for (const it of items) {
      const customer = it.list.customer;
      const key = alertDedupeKey(customer.id, ev.product.slugEn, evType);
      if (seen.has(key)) continue;
      seen.add(key);

      const locale = customer.locale === 'ar' ? 'ar' : 'en';
      const type = isStock ? ('BACK_IN_STOCK' as const) : ('PRICE_DROP' as const);
      const templateKey = isStock ? 'alert.back_in_stock' : 'alert.price_drop';
      const vars = { ...alertVars(ev as AlertEvent, locale), price: formatAlertPrice(ev.newValue) };

      if (emailEnabled && customer.user.email) {
        await notify({ customerId: customer.id, toAddress: customer.user.email, type, channel: 'EMAIL', templateKey, vars, refType: 'product', refId: ev.productId, locale });
        sent += 1;
      }
      await notify({ customerId: customer.id, type, channel: 'PUSH', templateKey, vars, refType: 'product', refId: ev.productId, locale });
      sent += 1;
    }
  }
  return { events: events.length, sent };
}
