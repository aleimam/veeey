import { z } from 'zod';
import { randomInt } from 'node:crypto';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { type OrderStatus, type StatusConfig } from '@/lib/order-status';
import { canTransition, statusConfig } from '@/lib/order-status-service';
import { deriveSystemMethod } from '@/lib/payment-method-service';
import { availableQty } from '@/lib/inventory';
import { getShippingFee, type ShippingTypeKey } from '@/lib/shipping-service';
import { getNumberSetting } from '@/lib/settings-service';
import { creditOrderPoints, creditReferralReward, reverseOrderPoints } from '@/lib/loyalty-service';
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
    ...(opts.status === 'attention'
      ? { status: { in: ['PENDING', 'CONFIRMED', 'HOLD'] as OrderStatus[] } } // matches the dashboard "orders need attention" KPI
      : opts.status
        ? { status: opts.status as OrderStatus }
        : {}),
    ...(opts.payment ? { paymentMethod: opts.payment as Prisma.OrderWhereInput['paymentMethod'] } : {}),
    ...(opts.payCheck ? { payCheck: opts.payCheck as 'NO' | 'YES' | 'PROBLEM' } : {}),
    // Order-number search now also matches the customer (email / name / phone)
    // and guest email, so staff can look up an order by who placed it.
    ...(opts.q
      ? { OR: [
          { number: { contains: opts.q, mode: 'insensitive' } },
          { guestEmail: { contains: opts.q, mode: 'insensitive' } },
          { customer: { firstName: { contains: opts.q, mode: 'insensitive' } } },
          { customer: { lastName: { contains: opts.q, mode: 'insensitive' } } },
          { customer: { user: { email: { contains: opts.q, mode: 'insensitive' } } } },
          { customer: { user: { phone: { contains: opts.q, mode: 'insensitive' } } } },
        ] }
      : opts.search
        ? { OR: [{ number: { contains: opts.search, mode: 'insensitive' } }, { guestEmail: { contains: opts.search, mode: 'insensitive' } }] }
        : {}),
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
    case 'customer': return { customer: { user: { email: dir } } };
    case 'payment': return { paymentMethod: dir };
    case 'items': return { items: { _count: dir } };
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

/** Interactive-transaction client of the (extended) prisma singleton. */
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function recomputeTotals(tx: Tx, orderId: string) {
  const items = await tx.orderItem.findMany({ where: { orderId, lost: false } }); // LOST lines excluded from totals/revenue
  const subtotal = items.reduce((s, i) => s + i.unitPricePiastres * BigInt(i.qty), 0n);
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  await tx.order.update({ where: { id: orderId }, data: { subtotalPiastres: subtotal, totalPiastres: subtotal + order.shippingPiastres - order.discountPiastres } });
}

/** Restock every non-lost, lot-bound line of an order (Cancelled/Refunded effect).
 *  Idempotent via a `status_restock` ledger marker so re-entry never double-counts.
 *  Gifts follow the same rule (own GiftMovement marker — gifts are counters, not lots). */
async function restockOrder(orderId: string) {
  const marker = await prisma.movementLedger.findFirst({ where: { refType: 'status_restock', refId: orderId } });
  if (!marker) {
    const items = await prisma.order.findUnique({ where: { id: orderId }, select: { items: { where: { lost: false, lotId: { not: null } }, include: { lot: { select: { locationId: true } } } } } });
    for (const it of items?.items ?? []) {
      if (!it.lotId || !it.lot) continue;
      await prisma.lot.update({ where: { id: it.lotId }, data: { qtyOnHand: { increment: it.qty } } });
      await prisma.movementLedger.create({ data: { lotId: it.lotId, locationId: it.lot.locationId, type: 'RETURN', qtyDelta: it.qty, refType: 'status_restock', refId: orderId } });
    }
  }
  const giftMarker = await prisma.giftMovement.findFirst({ where: { refType: 'status_restock', refId: orderId } });
  if (!giftMarker) {
    const orderGifts = await prisma.orderGift.findMany({ where: { orderId } });
    for (const og of orderGifts) {
      await prisma.gift.update({ where: { id: og.giftId }, data: { stock: { increment: og.qty } } });
      await prisma.giftMovement.create({ data: { giftId: og.giftId, type: 'RETURN', qtyDelta: og.qty, refType: 'status_restock', refId: orderId } });
    }
  }
}

/** Customer + (best-effort) staff notification for a status, per its config. */
async function runStatusNotify(orderId: string, cfg: StatusConfig | undefined) {
  if (!cfg || cfg.notifyAudience === 'none') return;
  const template = cfg.notifyTemplateKey || `order.${cfg.code.toLowerCase()}`;
  if (cfg.notifyAudience === 'customer' || cfg.notifyAudience === 'both') await notifyOrder(orderId, template);
  // Staff-channel dispatch is wired in Phase 2 (needs a staff/ops target); the
  // config knob is honored for the customer side today.
}

/** Apply a status's configured effects (stock/payment/revenue/loyalty), idempotently. */
async function applyStatusEffects(order: { id: string; number: string; totalPiastres: bigint; status: string }, from: string, cfg: StatusConfig | undefined) {
  if (!cfg) return;
  if (cfg.stockEffect === 'restock') await restockOrder(order.id);
  if (cfg.paymentEffect === 'paid') await prisma.order.update({ where: { id: order.id }, data: { paymentState: 'PAID' } });
  else if (cfg.paymentEffect === 'refunded') await prisma.order.update({ where: { id: order.id }, data: { paymentState: 'REFUNDED' } });
  if (cfg.revenueEffect === 'realize') {
    await recordOutbox('revenue.event', order.number, { veeeyOrderId: order.number, amountEgp: Number(order.totalPiastres) / 100, occurredAt: new Date().toISOString() });
  } else if (cfg.revenueEffect === 'reverse' && from === 'DELIVERED') {
    // Only reverse revenue that was actually realized (i.e. the order was Delivered).
    await recordOutbox('revenue.event', `${order.number}-reversal`, { veeeyOrderId: order.number, amountEgp: -Number(order.totalPiastres) / 100, occurredAt: new Date().toISOString() });
  }
  if (cfg.loyaltyEffect === 'credit') {
    await creditOrderPoints(order.id);
    await creditReferralReward(order.id); // referrer earns a configured share of the referee's order points
  } else if (cfg.loyaltyEffect === 'reverse') {
    await reverseOrderPoints(order.id); // idempotent; no-op if nothing was credited
  }
}

export async function transitionOrder(id: string, to: OrderStatus, reason?: string) {
  const user = await requirePermission('orders.write');
  const order = await prisma.order.findUniqueOrThrow({ where: { id } });
  const from = order.status;
  if (!(await canTransition(from, to))) throw new Error('INVALID_TRANSITION');
  const cfg = await statusConfig(to);
  await applyStatusEffects(order, from, cfg);
  const updated = await prisma.order.update({
    where: { id },
    data: { status: to, ...(cfg?.customerCode ? { customerStatus: cfg.customerCode } : {}) },
  });
  await audit({ actorType: 'USER', actorId: user.id, action: `order.${to.toLowerCase()}`, entityType: 'Order', entityId: id, data: { reason } });
  await runStatusNotify(id, cfg);
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

/** Staff override of the granular system payment method (e.g. pick which POS / bank). */
export async function setSystemPaymentMethod(id: string, systemCode: string | null) {
  const user = await requirePermission('orders.write');
  await prisma.order.update({ where: { id }, data: { systemPaymentMethod: systemCode || null } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'order.system_payment', entityType: 'Order', entityId: id, data: { systemCode } });
}

/** Set the order channel (Order.source). */
export async function setOrderChannel(id: string, channel: string) {
  const user = await requirePermission('orders.write');
  await prisma.order.update({ where: { id }, data: { source: channel || null } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'order.channel', entityType: 'Order', entityId: id, data: { channel } });
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
  const toShipped = await canTransition(order.status, 'SHIPPED');
  const nextStatus = toShipped ? 'SHIPPED' : order.status;
  // Courier now known → derive the granular system method (e.g. COD → COD+SMSA).
  // Only set when derivable so a staff-chosen POS/bank method isn't wiped.
  const sys = await deriveSystemMethod(order.paymentMethod, courier || null);
  await prisma.order.update({
    where: { id },
    data: {
      trackingNumber,
      courier: (courier || null) as 'ARAMEX' | 'SMSA' | 'OWN' | null,
      status: nextStatus,
      ...(toShipped ? { customerStatus: 'SHIPPED' } : {}),
      ...(sys ? { systemPaymentMethod: sys } : {}),
    },
  });
  await audit({ actorType: 'USER', actorId: user.id, action: 'order.tracking', entityType: 'Order', entityId: id, data: { trackingNumber, notifyCustomer: true } });
  if (toShipped) await notifyOrder(id, 'order.shipped');
}

/** Edit / clear tracking (Quick Edit). Editing courier/number alone keeps status;
 *  clearing tracking on a Shipped order reverts it to Confirmed (per spec). */
export async function clearTracking(id: string) {
  const user = await requirePermission('orders.fulfill');
  const order = await prisma.order.findUniqueOrThrow({ where: { id } });
  const revert = order.status === 'SHIPPED'; // only un-ship from Shipped, never from Delivered+
  await prisma.order.update({
    where: { id },
    data: { trackingNumber: null, courier: null, ...(revert ? { status: 'CONFIRMED', customerStatus: 'CONFIRMED' } : {}) },
  });
  await audit({ actorType: 'USER', actorId: user.id, action: 'order.tracking.clear', entityType: 'Order', entityId: id });
}

/** Edit-in-Hold: add a product to the order, FEFO-binding lot(s) + decrementing stock. */
export async function addOrderItem(orderId: string, productId: string, qty: number, lotId?: string | null) {
  const user = await requirePermission('orders.write');
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (!(['HOLD', 'EDIT', 'CONFIRMED', 'PENDING'] as string[]).includes(order.status)) throw new Error('NOT_EDITABLE');

    const res = await allocateOrderLine(tx, orderId, { productId, qty, lotId: lotId || null }, 'order_edit');

    if (res.shortfall > 0) {
      // Over-stock: mark the order pre-order + record/extend the Special Order.
      await tx.order.update({ where: { id: orderId }, data: { isPreorder: true } });
      const line = `${res.productName} (${res.productSku}) × ${res.shortfall}`;
      const existing = await tx.specialOrder.findUnique({ where: { orderId } });
      if (existing) {
        await tx.specialOrder.update({ where: { id: existing.id }, data: { requestedProductText: `${existing.requestedProductText ?? ''}; ${line}` } });
      } else {
        const snap = (order.shippingAddressJson ?? {}) as { name?: string; phone?: string };
        const leadDays = await getNumberSetting('specialOrder.defaultLeadDays');
        await tx.specialOrder.create({
          data: {
            orderId,
            customerId: order.customerId,
            requestedProductText: `Stock shortfall — ${order.number}: ${line}`,
            requesterName: snap.name || 'Staff order',
            requesterPhone: snap.phone || '—',
            status: 'REQUESTED',
            deadlineAt: new Date(Date.now() + Math.max(1, leadDays) * 86_400_000),
          },
        });
      }
    }
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

/**
 * Mark / unmark an order line as LOST (FR-ORD shrinkage). A LOST line is kept for
 * audit but excluded from order totals (→ drops out of revenue); stock is NOT
 * returned (the goods are gone). If loyalty points were already credited for the
 * order, that line's points are clawed back (restored on un-mark). Idempotent.
 */
export async function markOrderItemLost(orderItemId: string, lost: boolean, reason?: string) {
  const user = await requirePermission('orders.write');
  const orderId = await prisma.$transaction(async (tx) => {
    const item = await tx.orderItem.findUniqueOrThrow({ where: { id: orderItemId }, include: { order: { select: { customerId: true } } } });
    if (item.lost === lost) return item.orderId; // no-op
    await tx.orderItem.update({ where: { id: orderItemId }, data: { lost, lostAt: lost ? new Date() : null, lostReason: lost ? (reason || null) : null } });
    // Adjust loyalty only if the order already earned points and this line carried some.
    if (item.order.customerId && item.pointsEarned > 0) {
      const earned = await tx.loyaltyTransaction.findFirst({ where: { orderId: item.orderId, type: 'EARN' } });
      if (earned) {
        const delta = lost ? -item.pointsEarned : item.pointsEarned;
        await tx.loyaltyTransaction.create({ data: { customerId: item.order.customerId, points: delta, type: 'ADJUST', orderId: item.orderId, note: lost ? 'lost item' : 'restore lost item' } });
        await tx.customer.update({ where: { id: item.order.customerId }, data: { pointsBalance: { increment: delta } } });
      }
    }
    await recomputeTotals(tx, item.orderId);
    return item.orderId;
  });
  await audit({ actorType: 'USER', actorId: user.id, action: lost ? 'order.item.lost' : 'order.item.restore', entityType: 'Order', entityId: orderId, data: { orderItemId, reason } });
}

/** Manual / phone order creation (FR-ORD-05). Staff build an order on a
 *  customer's behalf: resolve the customer by email (or treat as guest), FEFO-
 *  allocate each line across nearest-expiry lots, decrement stock + ledger, and
 *  snapshot the address. Created in PENDING, attributed to the staff
 *  member (pharmacist) with source = "manual". */
// ---- Staff product picker (backend orders, Phase B) -------------------------
export type OrderProductHit = {
  id: string;
  name: string;
  sku: string;
  basePricePiastres: number;
  lots: { id: string; expiry: string | null; available: number; pricePiastres: number; condition: string }[];
};

const lotMonthYear = (d: Date | null) => (d ? `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}` : null);

/** Search products for the staff order pickers by name / SKU / id (also the
 *  legacy Egypt-Vitamins SKU / WP id). Returns each product's LIVE lots with
 *  per-expiry availability + price so staff pick an exact expiry. */
export async function searchOrderProducts(q: string): Promise<OrderProductHit[]> {
  await requirePermission('orders.write');
  const term = q.trim();
  if (term.length < 2) return [];
  const wpId = Number(term);
  const or: Prisma.ProductWhereInput[] = [
    { nameEn: { contains: term, mode: 'insensitive' } },
    { nameAr: { contains: term } },
    { sku: { contains: term, mode: 'insensitive' } },
    { legacySku: { contains: term, mode: 'insensitive' } },
    { id: term },
    ...(Number.isInteger(wpId) && wpId > 0 ? [{ legacyWpId: wpId }] : []),
  ];
  const rows = await prisma.product.findMany({
    where: { status: { in: ['PUBLISHED', 'PRIVATE'] }, OR: or },
    include: { lots: { where: { status: 'LIVE' }, orderBy: { expiryDate: 'asc' } } },
    take: 10,
  });
  return rows.map((p) => ({
    id: p.id,
    name: p.nameEn,
    sku: p.sku,
    basePricePiastres: Number(p.basePricePiastres),
    lots: p.lots
      .map((l) => ({
        id: l.id,
        expiry: lotMonthYear(l.expiryDate),
        available: Math.max(0, l.qtyOnHand - l.qtyReserved),
        pricePiastres: Number(l.priceOverridePiastres ?? p.basePricePiastres),
        condition: l.condition,
      }))
      .filter((l) => l.available > 0),
  }));
}

type LineAlloc = { subtotal: bigint; shortfall: number; productName: string; productSku: string };

/**
 * Allocate one staff order line inside a transaction. With `lotId` the exact
 * expiry the staff picked is used; otherwise FEFO (NEW units first). Any
 * quantity beyond available stock becomes a PRE-ORDER line (no lot bound, no
 * stock decrement — owner decision: deduct what exists, flag the shortfall).
 */
async function allocateOrderLine(
  tx: Tx,
  orderId: string,
  item: { productId: string; qty: number; lotId?: string | null },
  refType: string,
): Promise<LineAlloc> {
  const product = await tx.product.findUniqueOrThrow({
    where: { id: item.productId },
    select: { basePricePiastres: true, weightG: true, nameEn: true, sku: true },
  });
  let remaining = item.qty;
  let subtotal = 0n;
  let chosenUnit: bigint | null = null;

  const lots = item.lotId
    ? await tx.lot.findMany({ where: { id: item.lotId, productId: item.productId, status: 'LIVE' }, include: { product: true } })
    : (await tx.lot.findMany({ where: { productId: item.productId, status: 'LIVE' }, orderBy: { expiryDate: 'asc' }, include: { product: true } }))
        .sort((a, b) => Number(a.condition !== 'NEW') - Number(b.condition !== 'NEW')); // prefer NEW units, FEFO within

  for (const lot of lots) {
    if (remaining <= 0) break;
    const avail = availableQty(lot);
    if (avail <= 0) continue;
    const take = Math.min(avail, remaining);
    const unit = lot.priceOverridePiastres ?? lot.product.basePricePiastres;
    if (item.lotId) chosenUnit = unit;
    await tx.orderItem.create({ data: { orderId, productId: item.productId, lotId: lot.id, qty: take, unitPricePiastres: unit, lineExpiry: lot.expiryDate, condition: lot.condition, weightG: lot.product.weightG } });
    await tx.lot.update({ where: { id: lot.id }, data: { qtyOnHand: { decrement: take } } });
    await tx.movementLedger.create({ data: { lotId: lot.id, locationId: lot.locationId, type: 'SALE', qtyDelta: -take, refType, refId: orderId } });
    subtotal += unit * BigInt(take);
    remaining -= take;
  }

  if (remaining > 0) {
    const unit = chosenUnit ?? product.basePricePiastres;
    await tx.orderItem.create({ data: { orderId, productId: item.productId, qty: remaining, unitPricePiastres: unit, preorder: true, weightG: product.weightG } });
    subtotal += unit * BigInt(remaining);
  }
  return { subtotal, shortfall: remaining, productName: product.nameEn, productSku: product.sku };
}

const manualOrderSchema = z.object({
  customerId: z.string().trim().optional().or(z.literal('')), // picked via the staff customer search
  addressId: z.string().trim().optional().or(z.literal('')), // reuse this saved address instead of creating one
  customerEmail: z.string().trim().email().optional().or(z.literal('')),
  name: z.string().trim().min(1),
  phone: z.string().trim().min(6),
  governorate: z.string().trim().min(1),
  city: z.string().trim().min(1),
  area: z.string().trim().optional().default(''),
  street: z.string().trim().min(1),
  shippingType: z.enum(['FAST_FREE', 'ULTRAFAST', 'PICK_FROM_OFFICE']).default('FAST_FREE'),
  paymentMethod: z.string().trim().min(1).default('COD'), // customer-facing method code (CUSTOMER_METHODS)
  channel: z.string().trim().min(1), // backend channel (Channel code); staff must choose (no Direct)
  discreetPackaging: z.boolean().default(false),
  items: z.array(z.object({
    productId: z.string().min(1),
    qty: z.coerce.number().int().positive(),
    lotId: z.string().optional().or(z.literal('')), // staff-picked expiry; empty = FEFO
  })).min(1),
  gifts: z.array(z.object({
    giftId: z.string().min(1),
    qty: z.coerce.number().int().positive(),
  })).optional().default([]), // hidden 0-value gifts, deducted from gift stock
});
export type ManualOrderInput = z.input<typeof manualOrderSchema>;

export async function createManualOrder(raw: ManualOrderInput) {
  const user = await requirePermission('orders.write');
  const d = manualOrderSchema.parse(raw);
  const shipping = await getShippingFee(d.shippingType as ShippingTypeKey);

  let customerId: string | null = null;
  let guestEmail: string | undefined;
  if (d.customerId) {
    // Picked in the customer search — must exist.
    const c = await prisma.customer.findUnique({ where: { id: d.customerId }, select: { id: true } });
    if (!c) throw new Error('CUSTOMER_NOT_FOUND');
    customerId = c.id;
  } else if (d.customerEmail) {
    const email = d.customerEmail.toLowerCase();
    const u = await prisma.user.findUnique({ where: { email }, include: { customer: true } });
    if (u?.customer) customerId = u.customer.id;
    else guestEmail = email;
  }

  const number = `VY-${Date.now().toString(36).toUpperCase()}-${randomInt(100, 999)}`;
  const addressSnapshot = { name: d.name, phone: d.phone, governorate: d.governorate, city: d.city, area: d.area, street: d.street };

  const order = await prisma.$transaction(async (tx) => {
    let shippingAddressId: string | null = null;
    if (customerId && d.addressId) {
      // Reuse the picked saved address (must belong to this customer).
      const existing = await tx.address.findFirst({ where: { id: d.addressId, customerId }, select: { id: true } });
      if (existing) shippingAddressId = existing.id;
    }
    if (customerId && !shippingAddressId) {
      const addr = await tx.address.create({ data: { customerId, governorate: d.governorate, city: d.city, area: d.area, street: d.street, phone: d.phone } });
      shippingAddressId = addr.id;
    }
    const ord = await tx.order.create({
      data: {
        number, customerId, guestEmail,
        status: 'PENDING', customerStatus: 'PENDING', paymentMethod: d.paymentMethod, systemPaymentMethod: await deriveSystemMethod(d.paymentMethod, null), paymentState: 'PENDING', payCheck: 'NO',
        subtotalPiastres: 0n, shippingPiastres: shipping, discountPiastres: 0n, totalPiastres: shipping,
        shippingType: d.shippingType, discreetPackaging: d.discreetPackaging,
        shippingAddressId, shippingAddressJson: addressSnapshot,
        pharmacistId: user.id, source: d.channel,
      },
    });

    let subtotal = 0n;
    const shortfalls: { name: string; sku: string; qty: number }[] = [];
    for (const it of d.items) {
      const res = await allocateOrderLine(tx, ord.id, { productId: it.productId, qty: it.qty, lotId: it.lotId || null }, 'order');
      subtotal += res.subtotal;
      if (res.shortfall > 0) shortfalls.push({ name: res.productName, sku: res.productSku, qty: res.shortfall });
    }

    // Hidden gifts (0-value, never on the customer invoice) — stock-checked.
    for (const g of d.gifts) await grantGift(tx, ord.id, g.giftId, g.qty);

    // Over-stock (owner decision): available units were deducted; the shortfall
    // flags the order as a pre-order and opens a Special Order for sourcing.
    if (shortfalls.length > 0) {
      const leadDays = await getNumberSetting('specialOrder.defaultLeadDays');
      await tx.specialOrder.create({
        data: {
          orderId: ord.id,
          customerId,
          requestedProductText: `Stock shortfall — ${number}: ${shortfalls.map((s) => `${s.name} (${s.sku}) × ${s.qty}`).join('; ')}`,
          requesterName: d.name,
          requesterPhone: d.phone,
          requesterEmail: guestEmail ?? null,
          status: 'REQUESTED',
          deadlineAt: new Date(Date.now() + Math.max(1, leadDays) * 86_400_000),
        },
      });
    }
    return tx.order.update({ where: { id: ord.id }, data: { subtotalPiastres: subtotal, totalPiastres: subtotal + shipping, isPreorder: shortfalls.length > 0 } });
  });

  await audit({ actorType: 'USER', actorId: user.id, action: 'order.manual.create', entityType: 'Order', entityId: order.id, data: { number } });
  return order;
}

/** Deduct gift stock and attach it to an order, with a GRANT movement (tx helper). */
async function grantGift(tx: Tx, orderId: string, giftId: string, qty: number) {
  const gift = await tx.gift.findUniqueOrThrow({ where: { id: giftId } });
  if (gift.stock < qty) throw new Error('NO_GIFT_STOCK');
  await tx.gift.update({ where: { id: giftId }, data: { stock: { decrement: qty } } });
  await tx.orderGift.create({ data: { orderId, giftId, qty } });
  await tx.giftMovement.create({ data: { giftId, type: 'GRANT', qtyDelta: -qty, refType: 'order', refId: orderId } });
}

/** Add a hidden 0-value gift (Gx-*) to an order (FR-ORD-10). */
export async function addGiftToOrder(orderId: string, giftId: string, qty = 1) {
  const user = await requirePermission('orders.write');
  await prisma.$transaction((tx) => grantGift(tx, orderId, giftId, qty));
  await audit({ actorType: 'USER', actorId: user.id, action: 'order.gift.add', entityType: 'Order', entityId: orderId });
}

/** Remove a gift line from an order and restock it (staff edit). */
export async function removeGiftFromOrder(orderGiftId: string) {
  const user = await requirePermission('orders.write');
  const orderId = await prisma.$transaction(async (tx) => {
    const og = await tx.orderGift.findUniqueOrThrow({ where: { id: orderGiftId } });
    await tx.orderGift.delete({ where: { id: orderGiftId } });
    await tx.gift.update({ where: { id: og.giftId }, data: { stock: { increment: og.qty } } });
    await tx.giftMovement.create({ data: { giftId: og.giftId, type: 'RETURN', qtyDelta: og.qty, refType: 'order_edit', refId: og.orderId } });
    return og.orderId;
  });
  await audit({ actorType: 'USER', actorId: user.id, action: 'order.gift.remove', entityType: 'Order', entityId: orderId });
}
