import { z } from 'zod';
import { randomInt } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { audit } from '@/lib/audit';
import { clearCartCookie } from '@/lib/cart-service';
import { getShippingFee, type ShippingTypeKey } from '@/lib/shipping-service';
import { orderTotal, depositAndBalance } from '@/lib/checkout-math';
import { scoreOrderRisk } from '@/lib/fraud';
import { applyCoupon } from '@/lib/coupon-service';
import { maxRedeemablePoints, pointsToPiastres } from '@/lib/loyalty';
import { getNumberSetting } from '@/lib/settings-service';
import { enqueue, QUEUES } from '@/lib/jobs';
import { notify, type NotifyInput } from '@/lib/notification-service';
import { smsConfigured } from '@/lib/provider-config';

/** Checkout → Order (FR-CHK-*, FR-ORD-01). Converts cart soft-holds into a real
 *  order: each reservation becomes an OrderItem bound to its lot (exact expiry
 *  travels), stock decrements, the SALE is ledgered, and the reservation clears. */

export const checkoutSchema = z.object({
  guestEmail: z.string().email().optional(),
  name: z.string().min(1),
  phone: z.string().min(6),
  governorate: z.string().min(1),
  city: z.string().min(1),
  area: z.string().optional().default(''),
  street: z.string().min(1),
  shippingType: z.enum(['FAST_FREE', 'ULTRAFAST', 'PICK_FROM_OFFICE']).default('FAST_FREE'),
  paymentMethod: z.string().trim().min(1).default('COD'), // PaymentMethodConfig.code
  discreetPackaging: z.boolean().default(false),
  couponCode: z.string().trim().optional(),
  redeemPoints: z.coerce.number().int().nonnegative().default(0),
});
export type CheckoutInput = z.input<typeof checkoutSchema>;

export async function placeOrder(cartId: string, raw: CheckoutInput) {
  const data = checkoutSchema.parse(raw);
  const session = await auth();
  const customerId = session?.user?.customerId ?? null;

  const reservations = await prisma.lotReservation.findMany({
    where: { sessionId: cartId },
    include: { lot: { include: { product: true } } },
  });
  if (reservations.length === 0) throw new Error('EMPTY_CART');

  let subtotal = 0n;
  for (const r of reservations) {
    subtotal += (r.lot.priceOverridePiastres ?? r.lot.product.basePricePiastres) * BigInt(r.qty);
  }
  const shipping = await getShippingFee(data.shippingType as ShippingTypeKey);

  const isFirstOrder = customerId ? (await prisma.order.count({ where: { customerId } })) === 0 : true;

  // Coupon (stacks with points + tier discount).
  let couponDiscount = 0n;
  let couponId: string | null = null;
  if (data.couponCode) {
    const c = await applyCoupon(data.couponCode, { subtotalPiastres: subtotal, customerId, isFirstOrder });
    if (c.ok) { couponDiscount = c.discountPiastres; couponId = c.couponId; }
  }

  // Loyalty redemption — rate (points per EGP) is admin-configurable.
  let usePoints = 0;
  let pointsValue = 0n;
  if (customerId && data.redeemPoints > 0) {
    const cust = await prisma.customer.findUnique({ where: { id: customerId } });
    const rate = await getNumberSetting('loyalty.redeemPointsPerEgp');
    const cap = subtotal - couponDiscount;
    usePoints = Math.min(data.redeemPoints, maxRedeemablePoints(cust?.pointsBalance ?? 0, cap > 0n ? cap : 0n, rate));
    pointsValue = pointsToPiastres(usePoints, rate);
  }

  const discount = couponDiscount + pointsValue;
  const total = orderTotal(subtotal, shipping, discount);

  const requiresDeposit = false;
  const { balancePiastres } = depositAndBalance(total, requiresDeposit);

  const recent = customerId
    ? await prisma.order.count({ where: { customerId, placedAt: { gte: new Date(Date.now() - 86_400_000) } } })
    : 0;
  const risk = scoreOrderRisk({
    totalPiastres: Number(total),
    isGuest: !customerId,
    itemCount: reservations.length,
    paymentMethod: data.paymentMethod,
    recentOrders24h: recent,
    addressProvided: !!data.street,
  });

  const number = `VY-${Date.now().toString(36).toUpperCase()}-${randomInt(100, 999)}`;
  const addressSnapshot = {
    name: data.name, phone: data.phone, governorate: data.governorate,
    city: data.city, area: data.area, street: data.street,
  };

  const order = await prisma.$transaction(async (tx) => {
    let shippingAddressId: string | null = null;
    if (customerId) {
      const addr = await tx.address.create({ data: { customerId, governorate: data.governorate, city: data.city, area: data.area, street: data.street, phone: data.phone } });
      shippingAddressId = addr.id;
    }
    const ord = await tx.order.create({
      data: {
        number,
        customerId,
        guestEmail: data.guestEmail,
        status: 'PENDING_CONFIRMATION',
        paymentMethod: data.paymentMethod,
        paymentState: 'PENDING',
        payCheck: risk.level === 'high' ? 'PROBLEM' : 'NO',
        riskScore: risk.score,
        subtotalPiastres: subtotal,
        shippingPiastres: shipping,
        discountPiastres: discount,
        totalPiastres: total,
        balanceDuePiastres: requiresDeposit ? balancePiastres : null,
        shippingType: data.shippingType,
        discreetPackaging: data.discreetPackaging,
        shippingAddressId,
        shippingAddressJson: addressSnapshot,
      },
    });

    for (const r of reservations) {
      const unit = r.lot.priceOverridePiastres ?? r.lot.product.basePricePiastres;
      await tx.orderItem.create({
        data: {
          orderId: ord.id,
          productId: r.lot.productId,
          lotId: r.lotId,
          qty: r.qty,
          unitPricePiastres: unit,
          lineExpiry: r.lot.expiryDate,
          pointsEarned: Math.floor((Number(unit) / 100) * r.qty),
        },
      });
      await tx.lot.update({ where: { id: r.lotId }, data: { qtyOnHand: { decrement: r.qty }, qtyReserved: { decrement: r.qty } } });
      await tx.movementLedger.create({ data: { lotId: r.lotId, locationId: r.lot.locationId, type: 'SALE', qtyDelta: -r.qty, refType: 'order', refId: ord.id } });
      await tx.lotReservation.delete({ where: { id: r.id } });
    }

    if (couponId) {
      await tx.couponRedemption.create({ data: { couponId, customerId, orderId: ord.id, amountPiastres: couponDiscount } });
    }
    if (usePoints > 0 && customerId) {
      await tx.loyaltyTransaction.create({ data: { customerId, points: -usePoints, type: 'REDEEM', orderId: ord.id, note: 'checkout redemption' } });
      await tx.customer.update({ where: { id: customerId }, data: { pointsBalance: { decrement: usePoints } } });
    }
    return ord;
  });

  await clearCartCookie();
  await audit({ actorType: customerId ? 'CUSTOMER' : 'SYSTEM', actorId: customerId, action: 'order.placed', entityType: 'Order', entityId: order.id, data: { number, risk } });

  // Order-confirmation email (FR-NOT-01) — best effort, off the critical path.
  let toEmail: string | null = null;
  try {
    toEmail = customerId
      ? (await prisma.customer.findUnique({ where: { id: customerId }, include: { user: { select: { email: true } } } }))?.user.email ?? null
      : data.guestEmail ?? null;
    const vars = { name: data.name, number, total: Number(total) / 100 };
    if (toEmail) {
      const payload: NotifyInput = { customerId, toAddress: toEmail, type: 'ORDER', channel: 'EMAIL', templateKey: 'order.placed', vars, refType: 'order', refId: order.id };
      await enqueue(QUEUES.notify, payload, () => notify(payload));
    }
    // Order-placed SMS — only when SMS is configured and the customer gave a phone.
    if (data.phone && (await smsConfigured())) {
      const sms: NotifyInput = { customerId, toAddress: data.phone, type: 'ORDER', channel: 'SMS', templateKey: 'order.placed', vars, refType: 'order', refId: order.id };
      await enqueue(QUEUES.notify, sms, () => notify(sms));
    }
  } catch { /* notifications never block checkout */ }

  return {
    number: order.number,
    riskLevel: risk.level,
    totalPiastres: total,
    paymentMethod: data.paymentMethod,
    name: data.name,
    phone: data.phone,
    email: toEmail ?? data.guestEmail ?? null,
  };
}

export function getOrderByNumber(number: string) {
  return prisma.order.findUnique({
    where: { number },
    include: { items: { include: { product: { select: { nameEn: true, sku: true } } } } },
  });
}
