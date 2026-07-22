import { z } from 'zod';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { audit } from '@/lib/audit';
import { clearCartCookie } from '@/lib/cart-service';
import { ATTR_COOKIE, parseAttribution } from '@/lib/attribution';
import { PREORDER_COOKIE, parsePreorderCart } from '@/lib/preorder-cart';
import { applyGiftRules } from '@/lib/gift-rule-service';
import { isFeatureEnabled } from '@/lib/feature-service';
import { getShippingFee, type ShippingTypeKey } from '@/lib/shipping-service';
import { tierSystemBenefits } from '@/lib/tier-benefit-service';
import { orderTotal, depositAndBalance } from '@/lib/checkout-math';
import { tierPriceMap } from '@/lib/pricing-service';
import { effectiveUnitPrice } from '@/lib/pricing';
import { scoreOrderRisk } from '@/lib/fraud';
import { applyCoupon, claimCouponRedemption } from '@/lib/coupon-service';
import { maxRedeemablePoints, pointsToPiastres } from '@/lib/loyalty';
import { getNumberSetting, getSetting } from '@/lib/settings-service';
import { normalizeDestination } from '@/lib/otp-service';
import { VERIFY_COOKIE, verifyCookieMatches } from '@/lib/verify-cookie';
import { smsConfigured, emailConfigured } from '@/lib/provider-config';
import { deriveSystemMethod, isOnlineMethod } from '@/lib/payment-method-service';
import { sendOrderPlacedNotifications } from '@/lib/order-placed-notify';
import { nextOrderNumber } from '@/lib/order-number';

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

/** V5 F30 — "verify email or phone to checkout". True when the shopper has a
 *  verified account contact or a signed guest-verification cookie matching the
 *  contact they're checking out with. */
export async function isCheckoutVerified(userId: string | null | undefined, phone: string, guestEmail?: string): Promise<boolean> {
  if (userId) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { emailVerified: true, phoneVerified: true } });
    if (u?.emailVerified || u?.phoneVerified) return true;
  }
  const jar = await cookies();
  const dests = [normalizeDestination(phone)?.dest, guestEmail ? normalizeDestination(guestEmail)?.dest : undefined];
  return verifyCookieMatches(jar.get(VERIFY_COOKIE)?.value, dests);
}

/** Gate is active only when the toggle is on AND at least one code channel
 *  (SMS / email) can actually deliver — never bricks checkout otherwise. */
export const checkoutVerificationRequired = async () => {
  if ((await getSetting('checkout.requireVerification')) !== 'true') return false;
  return (await smsConfigured()) || (await emailConfigured());
};

export async function placeOrder(cartId: string, raw: CheckoutInput) {
  const data = checkoutSchema.parse(raw);
  const session = await auth();
  const customerId = session?.user?.customerId ?? null;

  // Blocked accounts cannot order (V5 F31).
  if (customerId) {
    const standing = await prisma.customer.findUnique({ where: { id: customerId }, select: { status: true } });
    if (standing?.status === 'BLOCKED') throw new Error('CUSTOMER_BLOCKED');
  }

  // Contact verification gate (V5 F30, admin-toggleable).
  if (await checkoutVerificationRequired()) {
    const verified = await isCheckoutVerified(session?.user?.id, data.phone, data.guestEmail);
    if (!verified) throw new Error('VERIFY_REQUIRED');
  }

  // Codex audit P0: checkout consumed whatever reservations existed without
  // ever re-checking `expiresAt` or the lot's status — a hold the sweep should
  // have released, or a lot quarantined/expired after it was added to the cart,
  // still sold. The soft-hold window is only meaningful if it's re-read at the
  // moment of purchase.
  const allReservations = await prisma.lotReservation.findMany({
    where: { sessionId: cartId },
    include: { lot: { include: { product: true } } },
  });
  const nowForHolds = new Date();
  const reservations = allReservations.filter((r) => r.expiresAt > nowForHolds && r.lot.status === 'LIVE');
  // Refusing outright beats silently dropping lines: the customer reviewed a
  // cart and a total that no longer hold, so they must see the new one.
  if (reservations.length !== allReservations.length) throw new Error('RESERVATION_EXPIRED');

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

  // Per-item earned points use the customer's tier rate — must match what
  // creditOrderPoints will actually credit, or LOST-item clawbacks under-claw.
  const custTier = customerId ? await prisma.customer.findUnique({ where: { id: customerId }, select: { tierId: true, tier: { select: { earnRatePerEgp: true } } } }) : null;
  const earnRate = custTier?.tier?.earnRatePerEgp ?? 1;

  // Tier pricing (FR-PRC-03). The PDP advertised the tier price but every
  // money path — cart, subtotal, order line — charged the lot/base price, so
  // the discount was never actually granted (Codex audit P0). Resolved once
  // here and reused for the order lines below so the two cannot diverge.
  const tierPrices = await tierPriceMap(
    [...reservations.map((r) => r.lot.productId), ...preorders.map((l) => l.productId)],
    custTier?.tierId ?? null,
  );
  const unitFor = (productId: string, base: bigint, lotOverride?: bigint | null) =>
    effectiveUnitPrice({ basePiastres: base, lotOverridePiastres: lotOverride, tierPiastres: tierPrices.get(productId) });

  let subtotal = 0n;
  for (const r of reservations) {
    subtotal += unitFor(r.lot.productId, r.lot.product.basePricePiastres, r.lot.priceOverridePiastres) * BigInt(r.qty);
  }
  for (const l of preorders) {
    subtotal += unitFor(l.productId, preById.get(l.productId)!.basePricePiastres) * BigInt(l.qty);
  }

  // Tier benefits matrix (guests resolve to the base tier). Gates ship granted-
  // to-all (today's behavior); they only bite once the admin unticks a tier.
  const benefits = await tierSystemBenefits(custTier?.tierId ?? null);
  if (preorders.length > 0 && !benefits.has('preOrder')) throw new Error('PREORDER_NOT_AVAILABLE');
  // Discreet packaging is an entitlement — silently drop it rather than fail the order.
  const discreetPackaging = data.discreetPackaging && benefits.has('discreetShipping');

  let shipping = await getShippingFee(data.shippingType as ShippingTypeKey);
  if (benefits.has('freeShipping') || (data.shippingType === 'ULTRAFAST' && benefits.has('freeUltraFast'))) {
    shipping = 0n; // fee waived by the customer's tier; availability rules unchanged
  }

  // Guests are NOT "first order" — otherwise firstOrderOnly coupons are
  // infinitely reusable by checking out logged-out.
  const isFirstOrder = customerId ? (await prisma.order.count({ where: { customerId } })) === 0 : false;

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

  // Numeric order number from the per-store sequence (checkout backlog P1).
  const number = await nextOrderNumber();
  // Attribution snapshot (owner batch #7) — the proxy-captured last non-direct
  // touch travels onto the order; the manual Channel (source) stays separate.
  const attribution = parseAttribution((await cookies()).get(ATTR_COOKIE)?.value);
  // Granular system method (courier not yet known → null for COD; gateway for cards).
  const systemPaymentMethod = await deriveSystemMethod(data.paymentMethod, null);
  const giftsEnabled = await isFeatureEnabled('giftWithPurchase');
  const addressSnapshot = {
    name: data.name, phone: data.phone, governorate: data.governorate,
    city: data.city, area: data.area, street: data.street,
  };
  // Checkout backlog P0: an online card order is NOT "placed" until the money
  // moves. It opens in AWAITING_PAYMENT — hidden from the default admin list,
  // no notifications — and the payment webhook promotes it to PENDING (or the
  // sweep cancels + restocks it when the gateway session lapses). Offline
  // methods (COD / bank / POS) are genuinely placed right away, as before.
  const online = isOnlineMethod(data.paymentMethod);
  const openingStatus = online ? 'AWAITING_PAYMENT' : 'PENDING';

  const order = await prisma.$transaction(async (tx) => {
    let shippingAddressId: string | null = null;
    if (customerId) {
      // Persist the checkout address to the account (checkout backlog P1-5) —
      // find-or-create rather than create-always, so ordering twice with the
      // same details stops duplicating the address book.
      const same = await tx.address.findFirst({
        where: { customerId, governorate: data.governorate, city: data.city, area: data.area, street: data.street, phone: data.phone },
        select: { id: true },
      });
      shippingAddressId = same?.id
        ?? (await tx.address.create({ data: { customerId, governorate: data.governorate, city: data.city, area: data.area, street: data.street, phone: data.phone } })).id;
    }
    const ord = await tx.order.create({
      data: {
        number,
        customerId,
        guestEmail: data.guestEmail,
        status: openingStatus,
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
        discreetPackaging,
        source: 'DIRECT', // placed directly from the storefront
        utmJson: attribution ?? undefined,
        shippingAddressId,
        shippingAddressJson: addressSnapshot,
      },
    });

    // First entry of the durable status timeline (null → the order's opening
    // status). Every later hop is appended in transitionOrder.
    await tx.orderStatusHistory.create({ data: { orderId: ord.id, fromStatus: null, toStatus: ord.status, actorId: null, note: online ? 'order placed — awaiting payment' : 'order placed' } });

    for (const r of reservations) {
      const unit = unitFor(r.lot.productId, r.lot.product.basePricePiastres, r.lot.priceOverridePiastres);
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
      // Conditional claim, not a bare decrement: the reservation guarantees a
      // hold, but a stocktake correction or a quarantine between add-to-cart
      // and here can leave the lot unable to honour it. Predicated updateMany
      // re-evaluates under the row lock, so it cannot oversell or go negative.
      const claimed = await tx.lot.updateMany({
        where: { id: r.lotId, status: 'LIVE', qtyOnHand: { gte: r.qty }, qtyReserved: { gte: r.qty } },
        data: { qtyOnHand: { decrement: r.qty }, qtyReserved: { decrement: r.qty } },
      });
      if (claimed.count !== 1) throw new Error('STOCK_UNAVAILABLE');
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
          unitPricePiastres: unitFor(p.id, p.basePricePiastres),
          preorder: true,
          weightG: p.weightG,
          pointsEarned: 0,
        },
      });
    }

    if (couponId) {
      // Re-checks the usage caps under a row lock — the earlier applyCoupon()
      // count is only a price quote and races with concurrent checkouts.
      await claimCouponRedemption(tx, { couponId, customerId, orderId: ord.id, amountPiastres: couponDiscount });
    }
    if (usePoints > 0 && customerId) {
      // Codex audit P0: the balance was read OUTSIDE this transaction and the
      // decrement carried no predicate, so two concurrent checkouts could each
      // spend the same points and drive pointsBalance negative. The conditional
      // updateMany makes the claim atomic — a single statement that re-evaluates
      // `balance >= usePoints` while holding the row lock.
      const claimed = await tx.customer.updateMany({
        where: { id: customerId, pointsBalance: { gte: usePoints } },
        data: { pointsBalance: { decrement: usePoints } },
      });
      if (claimed.count !== 1) throw new Error('POINTS_BALANCE_CHANGED');
      await tx.loyaltyTransaction.create({ data: { customerId, points: -usePoints, type: 'REDEEM', orderId: ord.id, note: 'checkout redemption' } });
    }

    // Gift-with-purchase: attach any gifts this order earned (best-effort —
    // out-of-stock gifts are skipped, never blocks checkout). Skipped entirely
    // when the gift-with-purchase feature is switched off in the admin.
    if (giftsEnabled) {
      await applyGiftRules(tx, ord.id, {
        subtotalPiastres: subtotal,
        productIds: [...reservations.map((r) => r.lot.productId), ...preorders.map((l) => l.productId)],
      });
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

  // Order-placed notifications (FR-NOT-01) — best effort, off the critical path.
  // ONLINE methods defer to the payment webhook (checkout backlog P0-2): the
  // customer is told "order placed" only once the money actually moved.
  let toEmail: string | null = null;
  try {
    toEmail = customerId
      ? (await prisma.customer.findUnique({ where: { id: customerId }, include: { user: { select: { email: true } } } }))?.user.email ?? null
      : data.guestEmail ?? null;
    if (!online) await sendOrderPlacedNotifications(order.id);
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
    include: {
      items: { include: { product: { select: { nameEn: true, nameAr: true, sku: true } } } },
      gifts: { include: { gift: { select: { internalName: true, nameEn: true, nameAr: true } } } },
      statusHistory: { orderBy: { createdAt: 'asc' } },
    },
  });
}
