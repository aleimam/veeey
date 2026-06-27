import { z } from 'zod';
import { randomInt } from 'node:crypto';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { canTransition, isDelivered, type OrderStatus } from '@/lib/order-status';
import { availableQty } from '@/lib/inventory';
import { getShippingFee, type ShippingTypeKey } from '@/lib/shipping-service';
import { creditOrderPoints, creditReferralReward } from '@/lib/loyalty-service';
import { enqueue, QUEUES } from '@/lib/jobs';
import { notify, type NotifyInput } from '@/lib/notification-service';
import { smsConfigured } from '@/lib/provider-config';
import { recordOutbox } from '@/lib/integration/integration-service';

/** Phone captured on the order's address snapshot (used for order SMS). */
function orderPhone(shippingAddressJson: unknown): string | null {
  const j = shippingAddressJson as { phone?: string } | null;
  return j?.phone?.trim() || null;
}

/** Best-effort order email (FR-NOT-01). Resolves recipient, enqueues, never throws. */
async function notifyOrder(orderId: string, templateKey: string) {
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { customer: { include: { user: { select: { email: true } } } } } });
    if (!order) return;
    const vars = { number: order.number, tracking: order.trackingNumber ?? '' };
    const toEmail = order.customer?.user.email ?? order.guestEmail ?? null;
    if (toEmail) {
      const payload: NotifyInput = { customerId: order.customerId, toAddress: toEmail, type: 'ORDER', channel: 'EMAIL', templateKey, vars, refType: 'order', refId: orderId };
      await enqueue(QUEUES.notify, payload, () => notify(payload));
    }
    // Order SMS — only when SMS is configured and a phone is on the order.
    const phone = orderPhone(order.shippingAddressJson);
    if (phone && (await smsConfigured())) {
      const sms: NotifyInput = { customerId: order.customerId, toAddress: phone, type: 'ORDER', channel: 'SMS', templateKey, vars, refType: 'order', refId: orderId };
      await enqueue(QUEUES.notify, sms, () => notify(sms));
    }
  } catch {
    // notifications never block order ops
  }
}

/** Order management & fulfillment (FR-ORD-*). Status changes are guarded by the
 *  transition map; edit-in-Hold keeps stock correct via the movement ledger. */

export type OrderListOpts = {
  status?: string; payment?: string; payCheck?: string; search?: string; q?: string; from?: string; to?: string;
  sort?: string; dir?: 'asc' | 'desc'; page?: number; perPage?: number;
};

function orderWhere(opts: OrderListOpts): Prisma.OrderWhereInput {
  return {
    ...(opts.status ? { status: opts.status as OrderStatus } : {}),
    ...(opts.payment ? { paymentMethod: opts.payment as Prisma.OrderWhereInput['paymentMethod'] } : {}),
    ...(opts.payCheck ? { payCheck: opts.payCheck as 'NO' | 'YES' | 'PROBLEM' } : {}),
    ...(opts.q ? { number: { contains: opts.q, mode: 'insensitive' } } : {}),
    ...(opts.search ? { OR: [{ number: { contains: opts.search, mode: 'insensitive' } }, { guestEmail: { contains: opts.search, mode: 'insensitive' } }] } : {}),
    ...(opts.from || opts.to
      ? { placedAt: { ...(opts.from ? { gte: new Date(opts.from) } : {}), ...(opts.to ? { lte: new Date(`${opts.to}T23:59:59`) } : {}) } }
      : {}),
  };
}

function orderOrderBy(sort?: string, dir: 'asc' | 'desc' = 'desc'): Prisma.OrderOrderByWithRelationInput {
  switch (sort) {
    case 'number': return { number: dir };
    case 'total': return { totalPiastres: dir };
    case 'status': return { status: dir };
    default: return { placedAt: dir };
  }
}

export function listOrders(opts: OrderListOpts = {}) {
  const perPage = opts.perPage ?? 50;
  const take = opts.page != null ? perPage : 200;
  const skip = opts.page != null ? (Math.max(1, opts.page) - 1) * perPage : 0;
  return prisma.order.findMany({
    where: orderWhere(opts),
    include: { pharmacist: { select: { name: true } }, customer: { include: { user: { select: { email: true } } } }, _count: { select: { items: true } } },
    orderBy: orderOrderBy(opts.sort, opts.dir),
    skip,
    take,
  });
}

export function countOrders(opts: OrderListOpts = {}) {
  return prisma.order.count({ where: orderWhere(opts) });
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
  if (isDelivered(to)) {
    await creditOrderPoints(id);
    await creditReferralReward(id); // referrer earns a configured share of the referee's order points
    // Push revenue to YeldnIN for reconciliation (no-op while the flag is off).
    await recordOutbox('revenue.event', updated.number, { veeeyOrderId: updated.number, amountEgp: Number(updated.totalPiastres) / 100, occurredAt: new Date().toISOString() });
  }
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

/** Manual / phone order creation (FR-ORD-05). Staff build an order on a
 *  customer's behalf: resolve the customer by email (or treat as guest), FEFO-
 *  allocate each line across nearest-expiry lots, decrement stock + ledger, and
 *  snapshot the address. Created in PENDING_CONFIRMATION, attributed to the staff
 *  member (pharmacist) with source = "manual". */
const manualOrderSchema = z.object({
  customerEmail: z.string().trim().email().optional().or(z.literal('')),
  name: z.string().trim().min(1),
  phone: z.string().trim().min(6),
  governorate: z.string().trim().min(1),
  city: z.string().trim().min(1),
  area: z.string().trim().optional().default(''),
  street: z.string().trim().min(1),
  shippingType: z.enum(['FAST_FREE', 'ULTRAFAST', 'PICK_FROM_OFFICE']).default('FAST_FREE'),
  paymentMethod: z.string().trim().min(1).default('COD'), // PaymentMethodConfig.code
  discreetPackaging: z.boolean().default(false),
  items: z.array(z.object({ productId: z.string().min(1), qty: z.coerce.number().int().positive() })).min(1),
});
export type ManualOrderInput = z.input<typeof manualOrderSchema>;

export async function createManualOrder(raw: ManualOrderInput) {
  const user = await requirePermission('orders.write');
  const d = manualOrderSchema.parse(raw);
  const shipping = await getShippingFee(d.shippingType as ShippingTypeKey);

  let customerId: string | null = null;
  let guestEmail: string | undefined;
  if (d.customerEmail) {
    const email = d.customerEmail.toLowerCase();
    const u = await prisma.user.findUnique({ where: { email }, include: { customer: true } });
    if (u?.customer) customerId = u.customer.id;
    else guestEmail = email;
  }

  const number = `VY-${Date.now().toString(36).toUpperCase()}-${randomInt(100, 999)}`;
  const addressSnapshot = { name: d.name, phone: d.phone, governorate: d.governorate, city: d.city, area: d.area, street: d.street };

  const order = await prisma.$transaction(async (tx) => {
    let shippingAddressId: string | null = null;
    if (customerId) {
      const addr = await tx.address.create({ data: { customerId, governorate: d.governorate, city: d.city, area: d.area, street: d.street, phone: d.phone } });
      shippingAddressId = addr.id;
    }
    const ord = await tx.order.create({
      data: {
        number, customerId, guestEmail,
        status: 'PENDING_CONFIRMATION', paymentMethod: d.paymentMethod, paymentState: 'PENDING', payCheck: 'NO',
        subtotalPiastres: 0n, shippingPiastres: shipping, discountPiastres: 0n, totalPiastres: shipping,
        shippingType: d.shippingType, discreetPackaging: d.discreetPackaging,
        shippingAddressId, shippingAddressJson: addressSnapshot,
        pharmacistId: user.id, source: 'manual',
      },
    });

    let subtotal = 0n;
    for (const it of d.items) {
      const lots = await tx.lot.findMany({ where: { productId: it.productId, status: 'LIVE' }, orderBy: { expiryDate: 'asc' }, include: { product: true } });
      let remaining = it.qty;
      for (const lot of lots) {
        if (remaining <= 0) break;
        const avail = availableQty(lot);
        if (avail <= 0) continue;
        const take = Math.min(avail, remaining);
        const unit = lot.priceOverridePiastres ?? lot.product.basePricePiastres;
        await tx.orderItem.create({ data: { orderId: ord.id, productId: it.productId, lotId: lot.id, qty: take, unitPricePiastres: unit, lineExpiry: lot.expiryDate, weightG: lot.product.weightG } });
        await tx.lot.update({ where: { id: lot.id }, data: { qtyOnHand: { decrement: take } } });
        await tx.movementLedger.create({ data: { lotId: lot.id, locationId: lot.locationId, type: 'SALE', qtyDelta: -take, refType: 'order', refId: ord.id } });
        subtotal += unit * BigInt(take);
        remaining -= take;
      }
      if (remaining > 0) throw new Error('INSUFFICIENT_STOCK');
    }
    return tx.order.update({ where: { id: ord.id }, data: { subtotalPiastres: subtotal, totalPiastres: subtotal + shipping } });
  });

  await audit({ actorType: 'USER', actorId: user.id, action: 'order.manual.create', entityType: 'Order', entityId: order.id, data: { number } });
  return order;
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
