/**
 * The cart as the BROWSER sees it.
 *
 * `CartLine` (cart-service) carries a `Date` and is built per request on the
 * server. The drawer, the header badge and every "Add to cart" button now share
 * one live client-side copy instead of each re-reading the server, so the shape
 * they share has to be plain JSON and small enough to hand back on every add.
 *
 * Pure — no Prisma, no cookies — so the quantity maths that decides whether a
 * button shows "Add to cart" or a stepper is unit-testable.
 */
export type SnapshotLine = {
  productId: string;
  slug: string;
  name: string;
  image: string;
  qty: number;
  unitPricePiastres: number;
  subtotalPiastres: number;
  /** 'NEW' or a condition variant (OPEN_BOX / DAMAGED / BROKEN) — priced separately. */
  condition: string;
  preorder: boolean;
};

export type CartSnapshot = {
  lines: SnapshotLine[];
  /** Units, not lines — this is what the header badge shows. */
  count: number;
  subtotalPiastres: number;
};

export const EMPTY_CART: CartSnapshot = { lines: [], count: 0, subtotalPiastres: 0 };

export function snapshotOf(lines: SnapshotLine[]): CartSnapshot {
  return {
    lines,
    count: lines.reduce((n, l) => n + l.qty, 0),
    subtotalPiastres: lines.reduce((n, l) => n + l.subtotalPiastres, 0),
  };
}

/**
 * How many of this product are in the cart, for the exact line a button owns.
 *
 * Condition matters: a product can sit in the cart as both NEW and Open-box at
 * different prices, and the PDP's stepper must move the variant the shopper
 * actually selected — not the other one. Pre-order lines are separate again:
 * they hold no stock and are charged a deposit, so a pre-order in the cart must
 * not make the in-stock button read "already added".
 */
export function qtyInCart(
  cart: CartSnapshot,
  productId: string,
  opts: { condition?: string; preorder?: boolean } = {},
): number {
  const condition = opts.condition ?? 'NEW';
  const preorder = opts.preorder ?? false;
  return cart.lines
    .filter((l) => l.productId === productId && l.condition === condition && l.preorder === preorder)
    .reduce((n, l) => n + l.qty, 0);
}
