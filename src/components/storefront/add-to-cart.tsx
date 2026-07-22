'use client';

import { addToCartAction, updateCartQtyAction } from '@/server/cart-actions';
import { Icon } from '@/components/storefront/ui/icon';
import { useCartOptional } from '@/components/storefront/cart-store';

/**
 * "Add to Cart" that becomes the cart's quantity control once the product is in
 * it (owner 2026-07-23).
 *
 * Two behaviours in one component because they are the same control in two
 * states: press it and the item goes in, the drawer opens and the page stays
 * put; press it again — it is now a stepper editing that cart line directly, so
 * a shopper never has to open the cart to change their mind about quantity.
 *
 * Every state is also a real <form> posting a server action. With JavaScript we
 * intercept and keep the shopper in place; without it, the same press still
 * works and lands on /cart the old way. The storefront should not need JS to
 * sell.
 */
export function AddToCartButton({
  productId,
  locale,
  label,
  inCartLabel,
  ariaLabel,
  lotId,
  condition,
  qty = 1,
  className = 'v-btn v-btn--primary v-btn--sm v-btn--block',
  iconSize = 16,
  onAdded,
}: {
  productId: string;
  locale: string;
  label: string;
  /** Short "in cart" cue shown above the stepper. */
  inCartLabel: string;
  ariaLabel?: string;
  lotId?: string;
  /** Condition variant this button owns — the stepper edits only that line. */
  condition?: string;
  /** Units added per press (the PDP buy box passes its own picker's value). */
  qty?: number;
  className?: string;
  iconSize?: number;
  onAdded?: () => void;
}) {
  const cart = useCartOptional();
  const inCart = cart?.qtyOf(productId, { condition }) ?? 0;
  const busy = cart?.busyId === productId;
  const ar = locale === 'ar';

  if (inCart > 0) {
    const step = (next: number) => (e: React.FormEvent) => {
      if (!cart) return; // no JS / no provider — let the form post
      e.preventDefault();
      cart.setQty({ productId, qty: next, condition });
    };
    const stepBtn = 'flex size-8 items-center justify-center rounded-full text-slate transition-colors hover:bg-green-wash disabled:opacity-40';
    return (
      <div className="flex flex-col items-stretch gap-1">
        <span className="text-center text-[11px] font-bold uppercase tracking-[0.06em] text-green-dark">
          {inCartLabel}
        </span>
        <div
          className="flex items-center justify-between rounded-full border-[1.5px] border-green-dark bg-green-wash px-1.5"
          aria-busy={busy}
        >
          <form action={updateCartQtyAction} onSubmit={step(inCart - 1)}>
            <input type="hidden" name="productId" value={productId} />
            <input type="hidden" name="qty" value={inCart - 1} />
            {condition && <input type="hidden" name="condition" value={condition} />}
            <input type="hidden" name="locale" value={locale} />
            {/* At 1 the minus REMOVES the line — say so, or a screen-reader user
                hears "decrease" and silently loses the item. */}
            <button
              type="submit"
              disabled={busy}
              className={stepBtn}
              aria-label={inCart === 1 ? (ar ? 'إزالة من السلة' : 'Remove from cart') : ar ? 'إنقاص الكمية' : 'Decrease quantity'}
            >
              <Icon name={inCart === 1 ? 'x' : 'minus'} size={15} color="var(--slate)" />
            </button>
          </form>

          <span className="min-w-7 text-center text-[15px] font-bold text-green-dark" aria-live="polite">
            {inCart}
          </span>

          <form action={updateCartQtyAction} onSubmit={step(inCart + 1)}>
            <input type="hidden" name="productId" value={productId} />
            <input type="hidden" name="qty" value={inCart + 1} />
            {condition && <input type="hidden" name="condition" value={condition} />}
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" disabled={busy} className={stepBtn} aria-label={ar ? 'زيادة الكمية' : 'Increase quantity'}>
              <Icon name="plus" size={15} color="var(--slate)" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <form
      action={addToCartAction}
      onSubmit={(e) => {
        if (!cart) return;
        e.preventDefault();
        cart.add({ productId, qty, lotId, condition });
        onAdded?.();
      }}
    >
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="qty" value={qty} />
      {lotId && <input type="hidden" name="lotId" value={lotId} />}
      <input type="hidden" name="locale" value={locale} />
      <button type="submit" disabled={busy} aria-label={ariaLabel} className={className}>
        <span className="v-btn__icon" aria-hidden="true">
          <Icon name="shopping-cart" size={iconSize} />
        </span>
        {label}
      </button>
    </form>
  );
}
