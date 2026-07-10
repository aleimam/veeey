import { z } from 'zod';
import { randomInt } from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { audit } from '@/lib/audit';
import { clearCartCookie } from '@/lib/cart-service';
import { ATTR_COOKIE, parseAttribution } from '@/lib/attribution';
import { PREORDER_COOKIE, parsePreorderCart } from '@/lib/preorder-cart';
import { getShippingFee, type ShippingTypeKey } from '@/lib/shipping-service';
import { orderTotal, depositAndBalance } from '@/lib/checkout-math';
import { scoreOrderRisk } from '@/lib/fraud';
import { applyCoupon } from '@/lib/coupon-service';
import { maxRedeemablePoints, pointsToPiastres } from '@/lib/loyalty';
import { getNumberSetting } from '@/lib/settings-service';
import { enqueue, QUEUES } from '@/lib/jobs';
import { notify, type NotifyInput } from '@/lib/notification-service';
import { smsConfigured, whatsappConfigured } from '@/lib/provider-config';
import { deriveSystemMethod } from '@/lib/payment-method-service';

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
  paymentMethod: z.string().trim().min(1).default('COD'), // customer-facing method code (CUSTOMER_METHODS)
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

  // Pre-order lines (cookie-backed, no lot held) — validated against the live
  // catalog so a since-unpublished / no-longer-pre-order product is dropped.
  const cookieStore = await cookies();
  const preLines = parsePreorderCart(cookieStore.get(PREORDER_COOKIE)?.value);
  const preProducts = preLines.length
    ? await prisma.product.findMany({
        where: { id: { in: preLines.map((l) => l.productId) }, status: 'PUBLISHED', preorderEnabled: true },
        select: { id: true, basePricePiastres: true, weightG: true },
      })
    : [];
  const preById = new Map(preProducts.map((p) => [p.id, p]));
  const preorders = preLines.filter((l) => preById.has(l.productId));

  if (reservations.length === 0 && preorders.length === 0) throw new Error('EMPTY_CART');

  let subtotal = 0n;
  for (const r of reservations) {
    subtotal += (r.lot.priceOverridePiastres ?? r.lot.product.basePricePiastres) * BigInt(r.qty);
  }
  for (const l of preorders) {
    subtotal += preById.get(l.productId)!.basePricePiastres * BigInt(l.qty);
  }
  const shipping = await getShippingFee(data.shippingType as ShippingTypeKey);

  // Guests are NOT "first order" — otherwise firstOrderOnly coupons are
  // infinitely reusable by checking out logged-out.
  const isFirstOrder = customerId ? (await prisma.order.count({ where: { customerId } })) === 0 : false;

  // Per-item earned points use the customer's tier rate — must match what
  // creditOrderPoints will actually credit, or LOST-item clawbacks under-claw.
  const custTier = customerId ? await prisma.customer.findUnique({ where: { id: customerId }, select: { tier: { select: { earnRatePerEgp: true } } } }) : null;
  const earnRate = custTier?.tier?.earnRatePerEgp ?? 1;

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

  // Pre-order → deposit up front (admin-configurable %), balance on delivery.
  const requiresDeposit = preorders.length > 0;
  const depositPct = requiresDeposit ? await getNumberSetting('preorder.depositPercent') : 0;
  const { depositPiastres, balancePiastres } = depositAndBalance(total, requiresDeposit, depositPct);
  const amountDue = requiresDeposit ? depositPiastres : total; // charged now (gateway) / collected on delivery

  const recent = customerId
    ? await prisma.order.count({ where: { customerId, placedAt: { gte: new Date(Date.now() - 86_400_000) } } })
    : 0;
  const risk = scoreOrderRisk({
    totalPiastres: Number(total),
    isGuest: !customerId,
    itemCount: reservations.length + preorders.length,
    paymentMethod: data.paymentMethod,
    recentOrders24h: recent,
    addressProvided: !!data.street,
  });

  const number = `VY-${Date.now().toString(36).toUpperCase()}-${randomInt(100, 999)}`;
  // Attribution snapshot (owner batch #7) — the proxy-captured last non-direct
  // touch travels onto the order; the manual Channel (source) stays separate.
  const attribution = parseAttribution((await cookies()).get(ATTR_COOKIE)?.value);
  // Granular system method (courier not yet known → null for COD; gateway for cards).
  const systemPaymentMethod = await deriveSystemMethod(data.paymentMethod, null);
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
        status: 'PENDING',
        customerStatus: 'PENDING',
        paymentMethod: data.paymentMethod,
        systemPaymentMethod,
        paymentState: 'PENDING',
        payCheck: risk.level === 'high' ? 'PROBLEM' : 'NO',
        riskScore: risk.score,
        subtotalPiastres: subtotal,
        shippingPiastres: shipping,
        discountPiastres: discount,
        totalPiastres: total,
        isPreorder: requiresDeposit,
        depositPaidPiastres: requiresDeposit ? depositPiastres : null,
        balanceDuePiastres: requiresDeposit ? balancePiastres : null,
        shippingType: data.shippingType,
        discreetPackaging: data.discreetPackaging,
        source: 'DIRECT', // placed directly from the storefront
        utmJson: attribution ?? undefined,
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
          condition: r.lot.condition,
          pointsEarned: Math.floor((Number(unit) / 100) * r.qty * earnRate),
        },
      });
      await tx.lot.update({ where: { id: r.lotId }, data: { qtyOnHand: { decrement: r.qty }, qtyReserved: { decrement: r.qty } } });
      await tx.movementLedger.create({ data: { lotId: r.lotId, locationId: r.lot.locationId, type: 'SALE', qtyDelta: -r.qty, refType: 'order', refId: ord.id } });
      await tx.lotReservation.delete({ where: { id: r.id } });
    }

    // Pre-order lines: no lot bound, no stock decrement, no ledger/revenue and
    // no points until fulfilled (staff bind a lot + collect the balance when
    // stock arrives). The unit price is snapshotted at the current base price.
    for (const l of preorders) {
      const p = preById.get(l.productId)!;
      await tx.orderItem.create({
        data: {
          orderId: ord.id,
          productId: p.id,
          lotId: null,
          qty: l.qty,
          unitPricePiastres: p.basePricePiastres,
          preorder: true,
          weightG: p.weightG,
          pointsEarned: 0,
        },
      });
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
  // #185: the cart converted — drop any abandoned-cart snapshot for it.
  try {
    const { clearCartSnapshotByCartId } = await import('@/lib/abandoned-cart-service');
    await clearCartSnapshotByCartId(cartId);
  } catch { /* best-effort */ }
  // Remember this browser's recent order numbers so the (public) confirmation
  // page can gate access — order numbers alone are guessable.
  try {
    const jar = await cookies();
    const prev = (jar.get('vy_orders')?.value ?? '').split(',').filter(Boolean);
    jar.set('vy_orders', [...prev, number].slice(-5).join(','), { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
  } catch { /* cookie best-effort */ }
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
    // Order-placed WhatsApp — only when the WhatsApp provider is configured.
    if (data.phone && (await whatsappConfigured())) {
      const wa: NotifyInput = { customerId, toAddress: data.phone, type: 'ORDER', channel: 'WHATSAPP', templateKey: 'order.placed', vars, refType: 'order', refId: order.id };
      await enqueue(QUEUES.notify, wa, () => notify(wa));
    }
  } catch { /* notifications never block checkout */ }

  return {
    number: order.number,
    riskLevel: risk.level,
    totalPiastres: total,
    amountDuePiastres: amountDue, // deposit for pre-orders, full total otherwise (what the gateway charges)
    isPreorder: requiresDeposit,
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
