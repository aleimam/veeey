import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { reserveStock, releaseReservation } from '@/lib/inventory-service';

/**
 * Cart (FR-CHK-02). The cart IS the set of FEFO soft-holds for a cart session —
 * adding to cart reserves the nearest-expiry lot(s) (FR-INV-03), so the bound
 * lot's exact expiry travels through to the order. Cart id lives in a cookie.
 */
const CART_COOKIE = 'veeey-cart';
const CART_HOLD_MIN = 1440; // 24h hold for cart items

export async function readCartId(): Promise<string | null> {
  const c = await cookies();
  return c.get(CART_COOKIE)?.value ?? null;
}

export async function ensureCartId(): Promise<string> {
  const c = await cookies();
  let id = c.get(CART_COOKIE)?.value;
  if (!id) {
    id = randomUUID();
    c.set(CART_COOKIE, id, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
  }
  return id;
}

export async function clearCartCookie() {
  const c = await cookies();
  c.delete(CART_COOKIE);
}

export type CartLine = {
  productId: string;
  slug: string;
  name: string;
  brand: string;
  image: string;
  qty: number;
  unitPricePiastres: number;
  subtotalPiastres: number;
  nearestExpiry: Date | null;
  condition: string; // 'NEW' or an explicit variant (OPEN_BOX / DAMAGED / BROKEN)
};

export async function getCart(cartId: string, locale = 'en'): Promise<CartLine[]> {
  const res = await prisma.lotReservation.findMany({
    where: { sessionId: cartId },
    include: { lot: { include: { product: { include: { brand: true, images: { take: 1, orderBy: { sortOrder: 'asc' } } } } } } },
  });
  // Lines group by product × condition, so a NEW line and an Open-box line of
  // the same product stay separate (different prices, separate qty controls).
  const map = new Map<string, CartLine>();
  for (const r of res) {
    const p = r.lot.product;
    const unit = Number(r.lot.priceOverridePiastres ?? p.basePricePiastres);
    const key = `${p.id}:${r.lot.condition}`;
    const line = map.get(key) ?? {
      productId: p.id,
      slug: (locale === 'ar' ? p.slugAr : p.slugEn) ?? p.slugEn,
      name: (locale === 'ar' ? p.nameAr : p.nameEn) ?? p.nameEn,
      brand: p.brand?.nameEn ?? '',
      image: p.images[0]?.url ?? '/placeholder.svg',
      qty: 0,
      unitPricePiastres: unit,
      subtotalPiastres: 0,
      nearestExpiry: r.lot.expiryDate,
      condition: r.lot.condition,
    };
    line.qty += r.qty;
    line.subtotalPiastres += unit * r.qty;
    // Keep the earliest dated expiry; NA (null) never overrides a date, and
    // only remains if every bound lot is non-perishable.
    if (r.lot.expiryDate && (!line.nearestExpiry || r.lot.expiryDate < line.nearestExpiry)) line.nearestExpiry = r.lot.expiryDate;
    map.set(key, line);
  }
  return [...map.values()];
}

export async function cartCount(cartId: string): Promise<number> {
  const agg = await prisma.lotReservation.aggregate({ _sum: { qty: true }, where: { sessionId: cartId } });
  return agg._sum.qty ?? 0;
}

export function addToCart(
  cartId: string,
  productId: string,
  qty: number,
  opts: { lotId?: string; condition?: string; locationId?: string } = {},
) {
  return reserveStock(productId, opts.locationId ?? 'loc_main', qty, {
    sessionId: cartId,
    holdMinutes: CART_HOLD_MIN,
    lotId: opts.lotId,
    condition: opts.condition,
  });
}

/** Remove a product's holds — all of them, or only one condition line's. */
export async function removeFromCart(cartId: string, productId: string, condition?: string) {
  const res = await prisma.lotReservation.findMany({
    where: { sessionId: cartId, lot: { productId, ...(condition ? { condition } : {}) } },
    select: { id: true },
  });
  for (const r of res) await releaseReservation(r.id);
}

export async function setCartQty(cartId: string, productId: string, qty: number, condition = 'NEW') {
  await removeFromCart(cartId, productId, condition);
  if (qty > 0) await addToCart(cartId, productId, qty, { condition });
}
