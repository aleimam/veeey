'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { ensureCartId, readCartId, addToCart, setCartQty, removeFromCart } from '@/lib/cart-service';
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
  if (productId) {
    const cartId = await ensureCartId();
    try {
      await addToCart(cartId, productId, qty, { lotId });
    } catch {
      // INSUFFICIENT_STOCK — line simply won't appear; PDP offers pre-order.
    }
  }
  revalidatePath(`/${locale}/cart`);
  redirect(`/${locale}/cart`);
}

export async function updateCartQtyAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const productId = str(fd, 'productId');
  const qty = Number(str(fd, 'qty') ?? '0');
  const condition = str(fd, 'condition') ?? 'NEW';
  const cartId = await readCartId();
  if (cartId && productId) {
    try {
      await setCartQty(cartId, productId, Math.max(0, qty), condition);
    } catch {
      // keep prior qty on failure
    }
  }
  revalidatePath(`/${locale}/cart`);
  redirect(`/${locale}/cart`);
}

export async function removeFromCartAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const productId = str(fd, 'productId');
  const condition = str(fd, 'condition');
  const cartId = await readCartId();
  if (cartId && productId) await removeFromCart(cartId, productId, condition);
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
          totalPiastres: result.totalPiastres,
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
    console.error('placeOrder failed', e);
    return { error: 'invalid' };
  }
  if (gatewayUrl) redirect(gatewayUrl);
  redirect(`/${locale}/checkout/confirmation?order=${number}`);
}
