'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { addToCartJsonAction, setCartQtyJsonAction } from '@/server/cart-actions';
import { EMPTY_CART, qtyInCart, type CartSnapshot } from '@/lib/cart-snapshot';

/**
 * One live copy of the cart, shared by the header badge, the drawer and every
 * "Add to cart" button on the page.
 *
 * Before this, adding meant a redirect to /cart — the shopper was pulled out of
 * whatever they were browsing. Now the add happens in place, the drawer slides
 * open, and the button they pressed becomes a quantity stepper.
 *
 * Seeded by the server layout, so the FIRST render (including SSR) already
 * knows what is in the cart: a button for an already-added product renders as a
 * stepper straight away instead of flashing "Add to cart" and correcting itself.
 */
type Ctx = {
  cart: CartSnapshot;
  open: boolean;
  /** Product id currently being written, so only that button shows a spinner. */
  busyId: string | null;
  /** Last failure, for the drawer to explain — cleared on the next successful write. */
  error: 'stock' | null;
  openDrawer: () => void;
  closeDrawer: () => void;
  clearError: () => void;
  add: (input: { productId: string; qty?: number; lotId?: string; condition?: string }) => void;
  setQty: (input: { productId: string; qty: number; condition?: string; preorder?: boolean }) => void;
  qtyOf: (productId: string, opts?: { condition?: string; preorder?: boolean }) => number;
};

const CartCtx = createContext<Ctx | null>(null);

export function CartProvider({
  initial,
  locale,
  children,
}: {
  initial: CartSnapshot;
  locale: string;
  children: React.ReactNode;
}) {
  const [cart, setCart] = useState<CartSnapshot>(initial);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<'stock' | null>(null);
  const [, startTransition] = useTransition();

  // The provider outlives navigations, so `useState(initial)` alone would keep
  // showing a stale cart after the server changed it behind our back (placing an
  // order clears it). Re-seed only when the SERVER's value actually changed —
  // re-seeding on every render would stamp on our own optimistic writes.
  const seed = useRef(JSON.stringify(initial));
  useEffect(() => {
    const next = JSON.stringify(initial);
    if (next !== seed.current) {
      seed.current = next;
      setCart(initial);
    }
  }, [initial]);

  const add: Ctx['add'] = useCallback(
    ({ productId, qty = 1, lotId }) => {
      setBusyId(productId);
      setError(null);
      setOpen(true); // open immediately — waiting for the round-trip feels broken
      startTransition(async () => {
        const res = await addToCartJsonAction({ productId, qty, lotId, locale });
        setCart(res.cart);
        seed.current = JSON.stringify(res.cart); // our write IS the new truth
        if (res.error) setError(res.error);
        setBusyId(null);
      });
    },
    [locale],
  );

  const setQty: Ctx['setQty'] = useCallback(
    ({ productId, qty, condition, preorder }) => {
      setBusyId(productId);
      setError(null);
      startTransition(async () => {
        const res = await setCartQtyJsonAction({ productId, qty, condition, preorder, locale });
        setCart(res.cart);
        seed.current = JSON.stringify(res.cart);
        if (res.error) setError(res.error);
        setBusyId(null);
      });
    },
    [locale],
  );

  const value = useMemo<Ctx>(
    () => ({
      cart,
      open,
      busyId,
      error,
      openDrawer: () => setOpen(true),
      closeDrawer: () => setOpen(false),
      clearError: () => setError(null),
      add,
      setQty,
      qtyOf: (productId, opts) => qtyInCart(cart, productId, opts),
    }),
    [cart, open, busyId, error, add, setQty],
  );

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

/**
 * Null outside a provider rather than throwing: the add-to-cart button also
 * renders in places that have no storefront chrome (and must still work as a
 * plain form), so "no provider" is a supported state, not a bug.
 */
export function useCartOptional(): Ctx | null {
  return useContext(CartCtx);
}

export function useCart(): Ctx {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}

export { EMPTY_CART };
