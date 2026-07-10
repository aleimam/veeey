import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { reserveStock, releaseReservation } from '@/lib/inventory-service';
import {
  PREORDER_COOKIE, parsePreorderCart, serializePreorderCart, addPreorderLine,
  setPreorderQty as setPreorderQtyPure, removePreorderLine, preorderCount, type PreorderLine,
} from '@/lib/preorder-cart';

/**
 * Cart (FR-CHK-02). The cart IS the set of FEFO soft-holds for a cart session —
 * adding to cart reserves the nearest-expiry lot(s) (FR-INV-03), so the bound
 * lot's exact expiry travels through to the order. Cart id lives in a cookie.
 * Pre-order lines (products bought before they are back in stock) have no lot
 * to hold, so they live in a separate JSON cookie (see preorder-cart.ts).
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
  c.delete(PREORDER_COOKIE);
}

// ---- Pre-order lines (cookie-backed) ---------------------------------------
export async function readPreorderLines(): Promise<PreorderLine[]> {
  const c = await cookies();
  return parsePreorderCart(c.get(PREORDER_COOKIE)?.value);
}

async function writePreorderLines(lines: PreorderLine[]) {
  const c = await cookies();
  if (lines.length === 0) c.delete(PREORDER_COOKIE);
  else c.set(PREORDER_COOKIE, serializePreorderCart(lines), { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
}

export async function addPreorder(productId: string, qty = 1) {
  // Only accept products that are actually published + pre-order enabled.
  const p = await prisma.product.findFirst({ where: { id: productId, status: 'PUBLISHED', preorderEnabled: true }, select: { id: true } });
  if (!p) return;
  await writePreorderLines(addPreorderLine(await readPreorderLines(), productId, qty));
}

export async function setPreorderQty(productId: string, qty: number) {
  await writePreorderLines(setPreorderQtyPure(await readPreorderLines(), productId, qty));
}

export async function removePreorder(productId: string) {
  await writePreorderLines(removePreorderLine(await readPreorderLines(), productId));
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
  preorder: boolean; // awaiting-stock line (no lot held); charged a deposit at checkout
};

/** Pre-order lines (cookie) resolved to CartLine rows at base price. */
async function preorderCartLines(locale: string): Promise<CartLine[]> {
  const lines = await readPreorderLines();
  if (lines.length === 0) return [];
  const products = await prisma.product.findMany({
    where: { id: { in: lines.map((l) => l.productId) }, status: 'PUBLISHED', preorderEnabled: true },
    include: { brand: true, images: { take: 1, orderBy: { sortOrder: 'asc' } } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const out: CartLine[] = [];
  for (const l of lines) {
    const p = byId.get(l.productId);
    if (!p) continue; // product unpublished / pre-order turned off → drop silently
    const unit = Number(p.basePricePiastres);
    out.push({
      productId: p.id,
      slug: (locale === 'ar' ? p.slugAr : p.slugEn) ?? p.slugEn,
      name: (locale === 'ar' ? p.nameAr : p.nameEn) ?? p.nameEn,
      brand: p.brand?.nameEn ?? '',
      image: p.images[0]?.url ?? '/placeholder.svg',
      qty: l.qty,
      unitPricePiastres: unit,
      subtotalPiastres: unit * l.qty,
      nearestExpiry: null,
      condition: 'NEW',
      preorder: true,
    });
  }
  return out;
}

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
      preorder: false,
    };
    line.qty += r.qty;
    line.subtotalPiastres += unit * r.qty;
    // Keep the earliest dated expiry; NA (null) never overrides a date, and
    // only remains if every bound lot is non-perishable.
    if (r.lot.expiryDate && (!line.nearestExpiry || r.lot.expiryDate < line.nearestExpiry)) line.nearestExpiry = r.lot.expiryDate;
    map.set(key, line);
  }
  return [...map.values(), ...(await preorderCartLines(locale))];
}

export async function cartCount(cartId: string): Promise<number> {
  const agg = await prisma.lotReservation.aggregate({ _sum: { qty: true }, where: { sessionId: cartId } });
  return (agg._sum.qty ?? 0) + preorderCount(await readPreorderLines());
}

export function addToCart(
  cartId: string,
  productId: string,
  qty: number,
  opts: { lotId?: string; condition?: string; locationId?: string } = {},
) {
  // No location filter: sell from any location's LIVE stock (FEFO). The old
  // hard-coded 'loc_main' default only matched the dev seed — on production
  // (generated location ids) it made every add-to-cart fail silently.
  return reserveStock(productId, opts.locationId ?? null, qty, {
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
  if (qty <= 0) return removeFromCart(cartId, productId, condition);
  // Adjust the delta instead of remove-then-re-add: the old approach destroyed
  // the customer's existing hold when the new qty exceeded stock (the re-add
  // threw AFTER the release, and another shopper could grab the freed units).
  const res = await prisma.lotReservation.findMany({
    where: { sessionId: cartId, lot: { productId, condition } },
    include: { lot: { select: { locationId: true, expiryDate: true } } },
  });
  const current = res.reduce((s, r) => s + r.qty, 0);
  if (qty > current) {
    await addToCart(cartId, productId, qty - current, { condition }); // throws INSUFFICIENT_STOCK with the old hold intact
    return;
  }
  // Decrease: give back from the latest-expiry holds first so FEFO units stay.
  let toRemove = current - qty;
  const byLatest = [...res].sort((a, b) => (b.lot.expiryDate?.getTime() ?? Infinity) - (a.lot.expiryDate?.getTime() ?? Infinity));
  for (const r of byLatest) {
    if (toRemove <= 0) break;
    if (r.qty <= toRemove) {
      await releaseReservation(r.id);
      toRemove -= r.qty;
    } else {
      await prisma.$transaction([
        prisma.lotReservation.update({ where: { id: r.id }, data: { qty: r.qty - toRemove } }),
        prisma.lot.update({ where: { id: r.lotId }, data: { qtyReserved: { decrement: toRemove } } }),
        prisma.movementLedger.create({ data: { lotId: r.lotId, locationId: r.lot.locationId, type: 'RELEASE', qtyDelta: toRemove, refType: 'reservation', refId: r.id } }),
      ]);
      toRemove = 0;
    }
  }
}

/**
 * Buy again (reorder): re-add a past order's regular lines to the current cart.
 * Merges duplicate products, skips gifts / lost / pre-order lines, and skips any
 * product that is no longer PUBLISHED or is out of stock (addToCart throws
 * INSUFFICIENT_STOCK). The order must belong to `customerId`. Returns how many
 * distinct products were added vs skipped.
 */
export async function reorderToCart(cartId: string, orderId: string, customerId: string): Promise<{ added: number; skipped: number }> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, customerId },
    select: { items: { where: { isGift: false, lost: false, preorder: false }, select: { productId: true, qty: true } } },
  });
  if (!order) return { added: 0, skipped: 0 };

  const wanted = new Map<string, number>();
  for (const it of order.items) wanted.set(it.productId, (wanted.get(it.productId) ?? 0) + it.qty);

  let added = 0;
  let skipped = 0;
  for (const [productId, qty] of wanted) {
    const p = await prisma.product.findFirst({ where: { id: productId, status: 'PUBLISHED' }, select: { id: true } });
    if (!p) { skipped += 1; continue; }
    try {
      await addToCart(cartId, productId, qty);
      added += 1;
    } catch {
      skipped += 1; // out of stock
    }
  }
  return { added, skipped };
}
