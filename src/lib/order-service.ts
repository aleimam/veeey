import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { canTransition, isDelivered, type OrderStatus } from '@/lib/order-status';
import { availableQty } from '@/lib/inventory';
import { creditOrderPoints } from '@/lib/loyalty-service';
import { enqueue, QUEUES } from '@/lib/jobs';
import { notify, type NotifyInput } from '@/lib/notification-service';

/** Best-effort order email (FR-NOT-01). Resolves recipient, enqueues, never throws. */
async function notifyOrder(orderId: string, templateKey: string) {
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { customer: { include: { user: { select: { email: true } } } } } });
    const toEmail = order?.customer?.user.email ?? order?.guestEmail ?? null;
    if (!order || !toEmail) return;
    const payload: NotifyInput = { customerId: order.customerId, toAddress: toEmail, type: 'ORDER', channel: 'EMAIL', templateKey, vars: { number: order.number, tracking: order.trackingNumber ?? '' }, refType: 'order', refId: orderId };
    await enqueue(QUEUES.notify, payload, () => notify(payload));
  } catch {
    // notifications never block order ops
  }
}

/** Order management & fulfillment (FR-ORD-*). Status changes are guarded by the
 *  transition map; edit-in-Hold keeps stock correct via the movement ledger. */

export function listOrders(opts: { status?: string; payCheck?: string; search?: string } = {}) {
  return prisma.order.findMany({
    where: {
      ...(opts.status ? { status: opts.status as OrderStatus } : {}),
      ...(opts.payCheck ? { payCheck: opts.payCheck as 'NO' | 'YES' | 'PROBLEM' } : {}),
      ...(opts.search ? { OR: [{ number: { contains: opts.search, mode: 'insensitive' } }, { guestEmail: { contains: opts.search, mode: 'insensitive' } }] } : {}),
    },
    include: { pharmacist: { select: { name: true } }, customer: { include: { user: { select: { email: true } } } }, _count: { select: { items: true } } },
    orderBy: { placedAt: 'desc' },
    take: 200,
  });
}

export function getOrder(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { product: { select: { nameEn: true, sku: true, weightG: true } }, lot: { select: { expiryDate: true, locationId: true } } } },
      gifts: { include: { gift: true } },
      customer: { include: { user: { select: { email: true } } } },
      pharmacist: { select: { id: true, name: true } },
      returns: { include: { items: true } },
    },
  });
}

async function recomputeTotals(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], orderId: string) {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  const subtotal = items.reduce((s, i) => s + i.unitPricePiastres * BigInt(i.qty), 0n);
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  await tx.order.update({ where: { id: orderId }, data: { subtotalPiastres: subtotal, totalPiastres: subtotal + order.shippingPiastres - order.discountPiastres } });
}

export async function transitionOrder(id: string, to: OrderStatus, reason?: string) {
  const user = await requirePermission('orders.write');
  const order = await prisma.order.findUniqueOrThrow({ where: { id } });
  if (!canTransition(order.status as OrderStatus, to)) throw new Error('INVALID_TRANSITION');
  const updated = await prisma.order.update({ where: { id }, data: { status: to } });
  // Loyalty points are earned once the order is delivered (revenue realized).
  if (isDelivered(to)) await creditOrderPoints(id);
  await audit({ actorType: 'USER', actorId: user.id, action: `order.${to.toLowerCase()}`, entityType: 'Order', entityId: id, data: { reason } });
  if (to === 'SHIPPED') await notifyOrder(id, 'order.shipped');
  else if (isDelivered(to)) await notifyOrder(id, 'order.delivered');
  return updated;
}

export async function assignPharmacist(id: string, pharmacistId: string | null) {
  const user = await requirePermission('orders.write');
  await prisma.order.update({ where: { id }, data: { pharmacistId } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'order.pharmacist', entityType: 'Order', entityId: id });
}

export async function setPayCheck(id: string, payCheck: 'NO' | 'YES' | 'PROBLEM') {
  const user = await requirePermission('orders.write');
  await prisma.order.update({ where: { id }, data: { payCheck } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'order.paycheck', entityType: 'Order', entityId: id, data: { payCheck } });
}

export async function setOrderMeta(id: string, meta: { customerOrderType?: string | null; orderProductType?: string | null; source?: string | null }) {
  const user = await requirePermission('orders.write');
  await prisma.order.update({
    where: { id },
    data: {
      customerOrderType: (meta.customerOrderType || null) as 'DISCOUNT_CHASER' | 'DOCTOR_RECOMMENDED' | 'SALES_ADVICE' | 'SELF_ORDERING' | null,
      orderProductType: (meta.orderProductType || null) as 'MISCELLANEOUS' | 'MALE_SUPPORT' | 'PREMIUM' | 'NEW' | 'TREND' | null,
      source: meta.source || null,
    },
  });
  await audit({ actorType: 'USER', actorId: user.id, action: 'order.meta', entityType: 'Order', entityId: id });
}

/** Add tracking → Shipped (event-driven, FR-ORD-02). Customer email queued in P12. */
export async function setTracking(id: string, trackingNumber: string, courier?: string) {
  const user = await requirePermission('orders.fulfill');
  const order = await prisma.order.findUniqueOrThrow({ where: { id } });
  const nextStatus = canTransition(order.status as OrderStatus, 'SHIPPED') ? 'SHIPPED' : (order.status as OrderStatus);
  await prisma.order.update({
    where: { id },
    data: { trackingNumber, courier: (courier || null) as 'ARAMEX' | 'SMSA' | 'OWN' | null, status: nextStatus },
  });
  await audit({ actorType: 'USER', actorId: user.id, action: 'order.tracking', entityType: 'Order', entityId: id, data: { trackingNumber, notifyCustomer: true } });
  if (nextStatus === 'SHIPPED') await notifyOrder(id, 'order.shipped');
}

/** Edit-in-Hold: add a product to the order, FEFO-binding lot(s) + decrementing stock. */
export async function addOrderItem(orderId: string, productId: string, qty: number) {
  const user = await requirePermission('orders.write');
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (!(['HOLD', 'EDIT', 'PROCESSING', 'PENDING_CONFIRMATION'] as string[]).includes(order.status)) throw new Error('NOT_EDITABLE');
    const lots = await tx.lot.findMany({ where: { productId, status: 'LIVE' }, orderBy: { expiryDate: 'asc' }, include: { product: true } });
    let remaining = qty;
    for (const lot of lots) {
      if (remaining <= 0) break;
      const avail = availableQty(lot);
      if (avail <= 0) continue;
      const take = Math.min(avail, remaining);
      const unit = lot.priceOverridePiastres ?? lot.product.basePricePiastres;
      await tx.orderItem.create({ data: { orderId, productId, lotId: lot.id, qty: take, unitPricePiastres: unit, lineExpiry: lot.expiryDate, weightG: lot.product.weightG } });
      await tx.lot.update({ where: { id: lot.id }, data: { qtyOnHand: { decrement: take } } });
      await tx.movementLedger.create({ data: { lotId: lot.id, locationId: lot.locationId, type: 'SALE', qtyDelta: -take, refType: 'order_edit', refId: orderId } });
      remaining -= take;
    }
    if (remaining > 0) throw new Error('INSUFFICIENT_STOCK');
    await recomputeTotals(tx, orderId);
  });
  await audit({ actorType: 'USER', actorId: user.id, action: 'order.item.add', entityType: 'Order', entityId: orderId });
}

export async function removeOrderItem(orderItemId: string) {
  const user = await requirePermission('orders.write');
  const orderId = await prisma.$transaction(async (tx) => {
    const item = await tx.orderItem.findUniqueOrThrow({ where: { id: orderItemId }, include: { lot: true } });
    if (item.lot) {
      await tx.lot.update({ where: { id: item.lotId! }, data: { qtyOnHand: { increment: item.qty } } });
      await tx.movementLedger.create({ data: { lotId: item.lotId!, locationId: item.lot.locationId, type: 'RETURN', qtyDelta: item.qty, refType: 'order_edit', refId: item.orderId } });
    }
    await tx.orderItem.delete({ where: { id: orderItemId } });
    await recomputeTotals(tx, item.orderId);
    return item.orderId;
  });
  await audit({ actorType: 'USER', actorId: user.id, action: 'order.item.remove', entityType: 'Order', entityId: orderId });
}

/** Add a hidden 0-value gift (Gx-*) to an order (FR-ORD-10). */
export async function addGiftToOrder(orderId: string, giftId: string, qty = 1) {
  const user = await requirePermission('orders.write');
  await prisma.$transaction(async (tx) => {
    const gift = await tx.gift.findUniqueOrThrow({ where: { id: giftId } });
    if (gift.stock < qty) throw new Error('NO_GIFT_STOCK');
    await tx.gift.update({ where: { id: giftId }, data: { stock: { decrement: qty } } });
    await tx.orderGift.create({ data: { orderId, giftId, qty } });
  });
  await audit({ actorType: 'USER', actorId: user.id, action: 'order.gift.add', entityType: 'Order', entityId: orderId });
}
