import { prisma } from '@/lib/prisma';
import { enqueue, QUEUES } from '@/lib/jobs';
import { notify, type NotifyInput } from '@/lib/notification-service';
import { smsConfigured, whatsappConfigured } from '@/lib/provider-config';

/**
 * Order-placed notifications (email + SMS + WhatsApp), extracted from placeOrder
 * (checkout backlog P0-2): for OFFLINE methods checkout still fires this at
 * placement, but for ONLINE card methods it now fires from the payment webhook
 * (`markOrderPaid`) — so a customer who abandons at the gateway is never told
 * "order placed". Loads everything from the order row, so both callers just pass
 * an id. Best-effort: never throws (notifications must not break placement or
 * webhook handling), idempotent via the NotificationLog unique-ish enqueue
 * being fired exactly once per call site (webhook settles idempotently before
 * calling).
 */
export async function sendOrderPlacedNotifications(orderId: string): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true, number: true, totalPiastres: true, customerId: true, guestEmail: true,
        shippingAddressJson: true,
        customer: { select: { user: { select: { email: true } } } },
      },
    });
    if (!order) return;
    const addr = (order.shippingAddressJson ?? {}) as { name?: string; phone?: string };
    const vars = { name: addr.name ?? '', number: order.number, total: Number(order.totalPiastres) / 100 };
    const toEmail = order.customer?.user.email ?? order.guestEmail ?? null;
    if (toEmail) {
      const payload: NotifyInput = { customerId: order.customerId, toAddress: toEmail, type: 'ORDER', channel: 'EMAIL', templateKey: 'order.placed', vars, refType: 'order', refId: order.id };
      await enqueue(QUEUES.notify, payload, () => notify(payload));
    }
    if (addr.phone && (await smsConfigured())) {
      const sms: NotifyInput = { customerId: order.customerId, toAddress: addr.phone, type: 'ORDER', channel: 'SMS', templateKey: 'order.placed', vars, refType: 'order', refId: order.id };
      await enqueue(QUEUES.notify, sms, () => notify(sms));
    }
    if (addr.phone && (await whatsappConfigured())) {
      const wa: NotifyInput = { customerId: order.customerId, toAddress: addr.phone, type: 'ORDER', channel: 'WHATSAPP', templateKey: 'order.placed', vars, refType: 'order', refId: order.id };
      await enqueue(QUEUES.notify, wa, () => notify(wa));
    }
  } catch (e) {
    console.error('order-placed notifications failed', e);
  }
}
