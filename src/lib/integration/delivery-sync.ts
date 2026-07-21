import { prisma } from '@/lib/prisma';
import { recordOutbox } from '@/lib/integration/integration-service';
import { resolveStoreKey, orderToDeliveryWire } from '@/lib/integration/delivery-wire';

/**
 * VEEEY Express hand-off (contract v2 §2.1). When Ops ship an order with the
 * `OWN` courier, the delivery job is created in YeldnIN, whose Ops then assign a
 * real courier; the assigned name/phone come BACK as the customer's tracking
 * detail (§2.3). Aramex/SMSA never come through here — they have their own AWB
 * APIs.
 *
 * The event is queued on the outbox (signed + retried by `dispatchOutbox`), and
 * YeldnIN's receiver is idempotent on (storeKey, orderNumber), so a double-click
 * or a retry can never create two delivery jobs for one order.
 */

export type SendDeliveryResult = { ok: true; queued: boolean } | { ok: false; error: string };

/** This deployment's store key — one codebase serves both stores. */
export function storeKey() {
  return resolveStoreKey(process.env.NEXT_PUBLIC_SITE_URL, process.env.INTEGRATION_STORE_KEY);
}

export async function sendVeeeyExpressDelivery(orderId: string): Promise<SendDeliveryResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      number: true, placedAt: true, paymentMethod: true, paymentState: true, totalPiastres: true,
      shippingAddressJson: true,
      customer: { select: { firstName: true, lastName: true, user: { select: { phone: true } } } },
      items: {
        where: { lost: false }, // a LOST line never leaves the shelf
        select: { qty: true, product: { select: { nameEn: true, sku: true } } },
      },
    },
  });
  if (!order) return { ok: false, error: 'order_not_found' };

  const customerName = [order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(' ').trim() || null;

  const wire = orderToDeliveryWire(storeKey(), {
    number: order.number,
    placedAt: order.placedAt,
    paymentMethod: order.paymentMethod,
    paymentState: order.paymentState,
    totalPiastres: order.totalPiastres,
    shippingAddressJson: order.shippingAddressJson,
    customerName,
    customerPhone: order.customer?.user?.phone ?? null,
    notes: null, // Veeey has no per-order note field today; the wire accepts null.
    lines: order.items.map((i) => ({ sku: i.product?.sku ?? null, name: i.product?.nameEn ?? '', qty: i.qty })),
  });

  // Refuse loudly rather than queue an event YeldnIN will reject: the three
  // hard requirements are a known store, a customer name and an address.
  if (!wire) {
    return { ok: false, error: storeKey() ? 'delivery_missing_customer_or_address' : 'delivery_unknown_store' };
  }

  // Null when the integration is off — the ship still succeeds locally, so say
  // whether it actually queued instead of implying a hand-off that never happened.
  const ev = await recordOutbox('deliveries.create', orderId, wire);
  return { ok: true, queued: ev != null };
}
