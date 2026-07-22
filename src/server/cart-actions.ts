'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { ensureCartId, readCartId, addToCart, setCartQty, removeFromCart, addPreorder, setPreorderQty, removePreorder, reorderToCart } from '@/lib/cart-service';
import { getCurrentUser } from '@/lib/auth-guards';
import { syncCartSnapshot } from '@/lib/abandoned-cart-service';
import { placeOrder, type CheckoutInput } from '@/lib/checkout-service';
import { buildCardRedirect } from '@/lib/payment-gateways';
import { isOnlineMethod, gatewayFor } from '@/lib/payment-method-service';

const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');
const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};

export async function addToCartAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const productId = str(fd, 'productId');
  const qty = Number(str(fd, 'qty') ?? '1') || 1;
  // Buy box pins the exact lot when the customer picks a condition variant
  // (Open-box / Damaged / Broken) — default adds pool NEW lots FEFO.
  const lotId = str(fd, 'lotId');
  let failed = false;
  if (productId) {
    const cartId = await ensureCartId();
    try {
      await addToCart(cartId, productId, qty, { lotId });
    } catch {
      failed = true; // INSUFFICIENT_STOCK — tell the shopper instead of a silent empty cart
    }
  }
  await syncCartSnapshot();
  revalidatePath(`/${locale}/cart`);
  redirect(`/${locale}/cart${failed ? '?add=out' : ''}`);
}

/** Buy again — re-add a past order's lines to the current cart (customer only). */
export async function buyAgainAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const orderId = str(fd, 'orderId');
  const user = await getCurrentUser();
  let added = 0;
  let skipped = 0;
  if (orderId && user?.customerId) {
    const cartId = await ensureCartId();
    ({ added, skipped } = await reorderToCart(cartId, orderId, user.customerId));
  }
  await syncCartSnapshot();
  revalidatePath(`/${locale}/cart`);
  redirect(`/${locale}/cart?again=${added}-${skipped}`);
}

/** Pre-order (buy before back in stock) — no lot to hold, so this writes the
 *  pre-order cookie instead of reserving stock. A deposit is taken at checkout. */
export async function addPreorderToCartAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const productId = str(fd, 'productId');
  const qty = Number(str(fd, 'qty') ?? '1') || 1;
  if (productId) await addPreorder(productId, qty);
  await syncCartSnapshot();
  revalidatePath(`/${locale}/cart`);
  redirect(`/${locale}/cart`);
}

export async function updateCartQtyAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const productId = str(fd, 'productId');
  const qty = Number(str(fd, 'qty') ?? '0');
  const condition = str(fd, 'condition') ?? 'NEW';
  let failed = false;
  if (productId) {
    if (fd.get('preorder') != null) {
      await setPreorderQty(productId, Math.max(0, qty));
    } else {
      const cartId = await readCartId();
      if (cartId) {
        try {
          await setCartQty(cartId, productId, Math.max(0, qty), condition);
        } catch {
          failed = true; // requested more than available
        }
      }
    }
  }
  await syncCartSnapshot();
  revalidatePath(`/${locale}/cart`);
  redirect(`/${locale}/cart${failed ? '?add=out' : ''}`);
}

export async function removeFromCartAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const productId = str(fd, 'productId');
  const condition = str(fd, 'condition');
  if (productId) {
    if (fd.get('preorder') != null) {
      await removePreorder(productId);
    } else {
      const cartId = await readCartId();
      if (cartId) await removeFromCart(cartId, productId, condition);
    }
  }
  await syncCartSnapshot();
  revalidatePath(`/${locale}/cart`);
  redirect(`/${locale}/cart`);
}

export type CheckoutState = { error?: string };

export async function placeOrderAction(_p: CheckoutState, fd: FormData): Promise<CheckoutState> {
  const locale = localeOf(fd);
  const cartId = await readCartId();
  if (!cartId) return { error: 'empty' };

  const input: CheckoutInput = {
    guestEmail: str(fd, 'guestEmail'),
    name: str(fd, 'name') ?? '',
    phone: str(fd, 'phone') ?? '',
    governorate: str(fd, 'governorate') ?? '',
    city: str(fd, 'city') ?? '',
    area: str(fd, 'area') ?? '',
    street: str(fd, 'street') ?? '',
    shippingType: (str(fd, 'shippingType') ?? 'FAST_FREE') as CheckoutInput['shippingType'],
    paymentMethod: (str(fd, 'paymentMethod') ?? 'COD') as CheckoutInput['paymentMethod'],
    discreetPackaging: fd.get('discreetPackaging') != null,
    couponCode: str(fd, 'couponCode'),
    redeemPoints: Number(str(fd, 'redeemPoints') ?? '0') || 0,
  };

  let number: string;
  let gatewayUrl: string | null = null;
  let online = false;
  try {
    const result = await placeOrder(cartId, input);
    number = result.number;
    // Online card method → hand off to the hosted gateway. The customer's choice
    // (CARD_OPAY / CARD_KASHIER) selects the gateway; if it isn't configured,
    // buildCardRedirect falls back to the admin default. The order opened in
    // AWAITING_PAYMENT (checkout backlog P0) — if the session can't even be
    // created, the customer lands on the payment-required screen, NOT a
    // success page: the order is held with a retry button and the sweep will
    // cancel + restock it if they walk away.
    if (isOnlineMethod(result.paymentMethod)) {
      online = true;
      const g = gatewayFor(result.paymentMethod);
      gatewayUrl = await buildCardRedirect(
        {
          number: result.number,
          // Pre-orders charge the deposit up front; everything else the full total.
          totalPiastres: result.amountDuePiastres,
          locale,
          name: result.name,
          email: result.email,
          phone: result.phone,
        },
        g === 'KASHIER' ? 'kashier' : g === 'OPAY' ? 'opay' : null,
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message === 'EMPTY_CART') return { error: 'empty' };
    if (e instanceof Error && e.message === 'VERIFY_REQUIRED') return { error: 'verify' };
    if (e instanceof Error && e.message === 'CUSTOMER_BLOCKED') return { error: 'blocked' };
    // The atomic points/coupon claims rejected: another order consumed the
    // balance or the last redemption between pricing and placement. Nothing was
    // charged — the customer just needs to reload so totals reprice.
    if (e instanceof Error && (e.message === 'POINTS_BALANCE_CHANGED' || e.message === 'COUPON_LIMIT_REACHED')) return { error: 'stale' };
    // The cart's stock hold lapsed, or a lot left LIVE / can no longer cover the
    // line. Nothing was reserved or charged; the cart needs rebuilding.
    if (e instanceof Error && (e.message === 'RESERVATION_EXPIRED' || e.message === 'STOCK_UNAVAILABLE')) return { error: 'stock' };
    console.error('placeOrder failed', e);
    return { error: 'invalid' };
  }
  if (gatewayUrl) redirect(gatewayUrl);
  // Card order whose gateway session failed to start → the confirmation page
  // renders the "payment could not be started" state (P0-1), never a silent ✓.
  redirect(`/${locale}/checkout/confirmation?order=${number}${online ? '&payfail=1' : ''}`);
}

/**
 * Retry payment for an AWAITING_PAYMENT order (checkout backlog P0): builds a
 * FRESH gateway session for the same order — the cart is long cleared, so
 * "try again" must not require rebuilding it. Gated exactly like the
 * confirmation page: the placing browser (vy_orders cookie) or the logged-in
 * owner. Amount = deposit for pre-orders, else the full total (same as placement).
 */
export async function retryPaymentAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const number = str(fd, 'number');
  if (!number) redirect(`/${locale}/cart`);
  const { cookies } = await import('next/headers');
  const { prisma } = await import('@/lib/prisma');
  const mine = ((await cookies()).get('vy_orders')?.value ?? '').split(',');
  const order = await prisma.order.findUnique({
    where: { number },
    select: { number: true, status: true, customerId: true, paymentMethod: true, isPreorder: true, depositPaidPiastres: true, totalPiastres: true, guestEmail: true, shippingAddressJson: true, customer: { select: { user: { select: { email: true } } } } },
  });
  let allowed = !!order && mine.includes(order.number);
  if (order && !allowed) {
    const user = await getCurrentUser();
    allowed = !!user?.customerId && user.customerId === order.customerId;
  }
  if (!order || !allowed || order.status !== 'AWAITING_PAYMENT' || !isOnlineMethod(order.paymentMethod)) {
    redirect(`/${locale}/checkout/confirmation?order=${encodeURIComponent(number!)}`);
  }
  const addr = (order.shippingAddressJson ?? {}) as { name?: string; phone?: string };
  const g = gatewayFor(order.paymentMethod);
  const url = await buildCardRedirect(
    {
      number: order.number,
      totalPiastres: order.isPreorder && order.depositPaidPiastres != null ? order.depositPaidPiastres : order.totalPiastres,
      locale,
      name: addr.name,
      email: order.customer?.user.email ?? order.guestEmail,
      phone: addr.phone,
    },
    g === 'KASHIER' ? 'kashier' : g === 'OPAY' ? 'opay' : null,
  );
  if (url) redirect(url);
  redirect(`/${locale}/checkout/confirmation?order=${encodeURIComponent(order.number)}&payfail=1`);
}
