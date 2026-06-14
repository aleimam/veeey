'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { ensureCartId, readCartId, addToCart, setCartQty, removeFromCart } from '@/lib/cart-service';
import { placeOrder, type CheckoutInput } from '@/lib/checkout-service';

const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');
const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};

export async function addToCartAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const productId = str(fd, 'productId');
  const qty = Number(str(fd, 'qty') ?? '1') || 1;
  if (productId) {
    const cartId = await ensureCartId();
    try {
      await addToCart(cartId, productId, qty);
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
  const cartId = await readCartId();
  if (cartId && productId) {
    try {
      await setCartQty(cartId, productId, Math.max(0, qty));
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
  const cartId = await readCartId();
  if (cartId && productId) await removeFromCart(cartId, productId);
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
  try {
    const result = await placeOrder(cartId, input);
    number = result.number;
  } catch (e) {
    if (e instanceof Error && e.message === 'EMPTY_CART') return { error: 'empty' };
    console.error('placeOrder failed', e);
    return { error: 'invalid' };
  }
  redirect(`/${locale}/checkout/confirmation?order=${number}`);
}
