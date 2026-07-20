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
  try {
    const result = await placeOrder(cartId, input);
    number = result.number;
    // Online card method → hand off to the hosted gateway. The customer's choice
    // (CARD_OPAY / CARD_KASHIER) selects the gateway; if it isn't configured,
    // buildCardRedirect falls back to the admin default, else returns null and we
    // fall through to the local confirmation (order stays pending payment).
    if (isOnlineMethod(result.paymentMethod)) {
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
  redirect(`/${locale}/checkout/confirmation?order=${number}`);
}
