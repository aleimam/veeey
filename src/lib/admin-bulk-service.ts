import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { deleteProduct, InUseError } from '@/lib/soft-delete-service';
import { transitionOrder, restockOrder } from '@/lib/order-service';
import { recomputeRating } from '@/lib/review-service';
import { recordPriceDropIfLower } from '@/lib/alert-service';
import type { OrderStatus } from '@/lib/order-status';
import type { SpecialOrderStatus } from '@/generated/prisma/client';

/**
 * Bulk operations for admin lists (apply one change to many selected rows). Each
 * entry is RBAC-gated + audited. `affected` = rows changed, `skipped` = rows the
 * op couldn't touch (e.g. a product still on an order during a bulk delete).
 */
export type BulkResult = { affected: number; skipped: number };

type ProductStatus = 'PUBLISHED' | 'PRIVATE' | 'DRAFT' | 'ARCHIVED';
type ProductKind = 'SUPPLEMENT' | 'DEVICE' | 'INJECTION';
type PayCheck = 'NO' | 'YES' | 'PROBLEM';
const PRODUCT_STATUS = new Set<ProductStatus>(['PUBLISHED', 'PRIVATE', 'DRAFT', 'ARCHIVED']);
const PRODUCT_KIND = new Set<ProductKind>(['SUPPLEMENT', 'DEVICE', 'INJECTION']);
const PAY_CHECK = new Set<PayCheck>(['NO', 'YES', 'PROBLEM']);

const empty = (): BulkResult => ({ affected: 0, skipped: 0 });

const LOT_STATUSES = new Set(['LIVE', 'QUARANTINE', 'EXPIRED', 'WRITTEN_OFF']);

/** Bulk lot operations (V4 C11): near-expiry discount % / status change.
 *  Discount reprices each lot from its PRODUCT base price and flags the sale
 *  (same effects as the per-lot markdown, incl. the SALE_LOT wishlist event). */
export async function bulkLots(op: string, ids: string[], value: string): Promise<BulkResult> {
  const user = await requirePermission('inventory.manage');
  if (ids.length === 0) return empty();
  const r = empty();

  if (op === 'discount') {
    const pct = Number(value);
    if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) throw new Error('BAD_DISCOUNT');
    const lots = await prisma.lot.findMany({ where: { id: { in: ids } }, include: { product: { select: { id: true, basePricePiastres: true } } } });
    const minNewByProduct = new Map<string, number>(); // lowest sale price per product (EGP), for the alert event
    for (let i = 0; i < lots.length; i += 50) {
      const chunk = lots.slice(i, i + 50);
      await Promise.all(chunk.map((l) => {
        const next = Math.max(0, Math.round(Number(l.product.basePricePiastres) * (1 - pct / 100)));
        const cur = minNewByProduct.get(l.product.id);
        if (cur == null || next < cur) minNewByProduct.set(l.product.id, next);
        return prisma.lot.update({ where: { id: l.id }, data: { priceOverridePiastres: BigInt(next), saleFlag: true } });
      }));
      r.affected += chunk.length;
    }
    // One SALE_LOT event per product → wishlist price alerts fan out once.
    await prisma.productChangeEvent.createMany({
      data: [...minNewByProduct].map(([productId, piastres]) => ({ productId, type: 'SALE_LOT' as const, newValue: (piastres / 100).toString() })),
    });
    await audit({ actorType: 'USER', actorId: user.id, action: 'lot.bulk.discount', entityType: 'Lot', data: { count: r.affected, pct } });
    return r;
  }

  if (op === 'status') {
    if (!LOT_STATUSES.has(value)) throw new Error('BAD_STATUS');
    const res = await prisma.lot.updateMany({ where: { id: { in: ids } }, data: { status: value as 'LIVE' | 'QUARANTINE' | 'EXPIRED' | 'WRITTEN_OFF' } });
    r.affected = res.count;
    await audit({ actorType: 'USER', actorId: user.id, action: 'lot.bulk.status', entityType: 'Lot', data: { count: r.affected, status: value } });
    return r;
  }

  throw new Error('BAD_OP');
}

export async function bulkProducts(op: string, ids: string[], value: string): Promise<BulkResult> {
  const user = await requirePermission('catalog.write');
  if (ids.length === 0) return empty();
  const r = empty();
  switch (op) {
    case 'status': {
      if (!PRODUCT_STATUS.has(value as ProductStatus)) throw new Error('BAD_VALUE');
      r.affected = (await prisma.product.updateMany({ where: { id: { in: ids } }, data: { status: value as ProductStatus } })).count;
      break;
    }
    case 'kind': {
      if (!PRODUCT_KIND.has(value as ProductKind)) throw new Error('BAD_VALUE');
      r.affected = (await prisma.product.updateMany({ where: { id: { in: ids } }, data: { kind: value as ProductKind } })).count;
      break;
    }
    case 'brand': {
      const brandId = value && value !== '__none__' ? value : null;
      r.affected = (await prisma.product.updateMany({ where: { id: { in: ids } }, data: { brandId } })).count;
      break;
    }
    case 'category': {
      if (!value) throw new Error('BAD_VALUE');
      for (const id of ids) {
        try { await prisma.product.update({ where: { id }, data: { categories: { connect: { id: value } } } }); r.affected++; } catch { r.skipped++; }
      }
      break;
    }
    case 'price_percent':
    case 'price_fixed':
    case 'price_set': {
      const mode = op.replace('price_', '') as 'percent' | 'fixed' | 'set';
      const res = await adjustProductPrices({ scope: 'ids', ids, mode, value: Number(value) }, user.id);
      r.affected = res.affected; r.skipped = res.skipped;
      return r; // adjustProductPrices writes its own audit summary (+ per-product diffs)
    }
    case 'origin': {
      const origin = value === '__none__' ? null : value;
      if (origin && !['USA', 'UK', 'EU'].includes(origin)) throw new Error('BAD_VALUE');
      const currency = origin === 'USA' ? 'USD' : origin === 'UK' ? 'GBP' : origin === 'EU' ? 'EUR' : null;
      r.affected = (await prisma.product.updateMany({ where: { id: { in: ids } }, data: { originCountry: origin, purchaseCurrency: currency } })).count;
      break;
    }
    case 'purchase_price': {
      const v = Number(value);
      if (!Number.isFinite(v) || v < 0) throw new Error('BAD_VALUE');
      // Purchase price is in the ORIGIN currency — products without an origin
      // (no currency) are skipped rather than stored ambiguously.
      r.affected = (await prisma.product.updateMany({
        where: { id: { in: ids }, purchaseCurrency: { not: null } },
        data: { purchaseCostMinor: Math.round(v * 100) },
      })).count;
      r.skipped = ids.length - r.affected;
      break;
    }
    case 'delete': {
      for (const id of ids) {
        try { await deleteProduct(id); r.affected++; } catch (e) { if (e instanceof InUseError) r.skipped++; else r.skipped++; }
      }
      break;
    }
    default:
      throw new Error('BAD_OP');
  }
  await audit({ actorType: 'USER', actorId: user.id, action: `bulk.products.${op}`, entityType: 'Product', entityId: `${ids.length} selected`, data: value ? { value } : undefined });
  return r;
}

// ---------------------------------------------------------------------------
// Price tools — selected-products bulk ops above delegate here; the "adjust ALL
// prices" panel calls adjustAllProductPrices. Per-product prisma.update is used
// (not updateMany) so the field-level change log records every old → new price;
// a summary audit entry captures the operation itself.
// ---------------------------------------------------------------------------

export type PriceAdjustInput = {
  scope: 'ids' | 'all';
  ids?: string[];
  mode: 'percent' | 'fixed' | 'set'; // percent: ±%, fixed: ±EGP, set: absolute EGP
  value: number;
};

export async function adjustProductPrices(input: PriceAdjustInput, actorId?: string): Promise<BulkResult> {
  const user = actorId ? { id: actorId } : await requirePermission('catalog.write');
  if (!Number.isFinite(input.value)) throw new Error('BAD_VALUE');
  if (input.mode === 'set' && input.value < 0) throw new Error('BAD_VALUE');
  if (input.scope === 'ids' && (!input.ids || input.ids.length === 0)) return empty();

  const where = input.scope === 'ids' ? { id: { in: input.ids! } } : {};
  const rows = await prisma.product.findMany({ where, select: { id: true, basePricePiastres: true } });

  const targets: { id: string; prev: bigint; next: bigint }[] = [];
  for (const p of rows) {
    const cur = Number(p.basePricePiastres);
    const next =
      input.mode === 'percent' ? Math.round(cur * (1 + input.value / 100))
      : input.mode === 'fixed' ? cur + Math.round(input.value * 100)
      : Math.round(input.value * 100);
    const clamped = BigInt(Math.max(0, next));
    if (clamped !== p.basePricePiastres) targets.push({ id: p.id, prev: p.basePricePiastres, next: clamped });
  }

  // Chunked per-product updates → change-log extension records each diff, and
  // price DROPS raise wishlist alert events (FR-WSH-02).
  const CHUNK = 50;
  let affected = 0;
  for (let i = 0; i < targets.length; i += CHUNK) {
    const chunk = targets.slice(i, i + CHUNK);
    await Promise.all(chunk.map((t) => prisma.product.update({ where: { id: t.id }, data: { basePricePiastres: t.next } })));
    await Promise.all(chunk.map((t) => recordPriceDropIfLower(t.id, t.prev, t.next)));
    affected += chunk.length;
  }

  await audit({
    actorType: 'USER', actorId: user.id, action: 'price.adjust', entityType: 'Product',
    entityId: input.scope === 'all' ? 'ALL products' : `${input.ids!.length} selected`,
    data: { mode: input.mode, value: input.value, scope: input.scope, changed: affected, unchanged: rows.length - affected },
  });
  return { affected, skipped: rows.length - affected };
}

/** Catalog-wide price adjustment (percent or ±EGP) — logged per product + summary. */
export async function adjustAllProductPrices(mode: 'percent' | 'fixed', value: number): Promise<BulkResult> {
  return adjustProductPrices({ scope: 'all', mode, value });
}

export async function bulkOrders(op: string, ids: string[], value: string): Promise<BulkResult> {
  const user = await requirePermission('orders.write');
  if (ids.length === 0) return empty();
  const r = empty();
  switch (op) {
    case 'status': {
      // Per-order transition so lifecycle side effects fire; invalid transitions are skipped.
      for (const id of ids) {
        try { await transitionOrder(id, value as OrderStatus); r.affected++; } catch { r.skipped++; }
      }
      break;
    }
    case 'payCheck': {
      if (!PAY_CHECK.has(value as PayCheck)) throw new Error('BAD_VALUE');
      r.affected = (await prisma.order.updateMany({ where: { id: { in: ids } }, data: { payCheck: value as PayCheck } })).count;
      break;
    }
    case 'delete': {
      // Guarded hard delete: only non-financial statuses (Pending / Cancelled).
      const deletable = await prisma.order.findMany({ where: { id: { in: ids }, status: { in: ['PENDING', 'CANCELLED'] } }, select: { id: true, status: true } });
      const delIds = deletable.map((o) => o.id);
      r.skipped = ids.length - delIds.length;
      // PENDING orders still hold deducted stock (checkout/staff SALE) —
      // restock before deleting or those units leak forever. CANCELLED orders
      // were already restocked by their status effect (marker keeps this
      // idempotent either way).
      for (const o of deletable) if (o.status === 'PENDING') await restockOrder(o.id);
      if (delIds.length) {
        await prisma.$transaction([
          // Detach loyalty ledger (orderId is optional) to preserve points history.
          prisma.loyaltyTransaction.updateMany({ where: { orderId: { in: delIds } }, data: { orderId: null } }),
          // Items / gifts / coupon redemptions / returns cascade on Order delete.
          prisma.order.deleteMany({ where: { id: { in: delIds } } }),
        ]);
        r.affected = delIds.length;
      }
      break;
    }
    default:
      throw new Error('BAD_OP');
  }
  await audit({ actorType: 'USER', actorId: user.id, action: `bulk.orders.${op}`, entityType: 'Order', entityId: `${ids.length} selected` });
  return r;
}

const REVIEW_STATUS: Record<string, 'APPROVED' | 'REJECTED'> = { approve: 'APPROVED', reject: 'REJECTED' };
export async function bulkReviews(op: string, ids: string[]): Promise<BulkResult> {
  const user = await requirePermission('reviews.moderate');
  if (ids.length === 0) return empty();
  const r = empty();
  const affected = await prisma.review.findMany({ where: { id: { in: ids } }, select: { productId: true } });
  const productIds = [...new Set(affected.map((a) => a.productId))];
  if (op === 'delete') {
    r.affected = (await prisma.review.deleteMany({ where: { id: { in: ids } } })).count; // ReviewMedia cascades
  } else if (REVIEW_STATUS[op]) {
    r.affected = (await prisma.review.updateMany({ where: { id: { in: ids } }, data: { status: REVIEW_STATUS[op], moderatorId: user.id } })).count;
  } else {
    throw new Error('BAD_OP');
  }
  for (const pid of productIds) await recomputeRating(pid); // keep product rating aggregates correct
  await audit({ actorType: 'USER', actorId: user.id, action: `bulk.reviews.${op}`, entityType: 'Review', entityId: `${ids.length} selected` });
  return r;
}

const SPECIAL_ORDER_STATUSES = new Set<SpecialOrderStatus>(['REQUESTED', 'DEPOSIT_PAID', 'SOURCING', 'PURCHASED', 'IN_TRANSIT', 'RECEIVED', 'FULFILLED', 'CANCELLED']);
export async function bulkSpecialOrders(op: string, ids: string[], value: string): Promise<BulkResult> {
  const user = await requirePermission('orders.write');
  if (ids.length === 0) return empty();
  const r = empty();
  if (op === 'status') {
    if (!SPECIAL_ORDER_STATUSES.has(value as SpecialOrderStatus)) throw new Error('BAD_VALUE');
    r.affected = (await prisma.specialOrder.updateMany({ where: { id: { in: ids } }, data: { status: value as SpecialOrderStatus } })).count;
  } else {
    throw new Error('BAD_OP');
  }
  await audit({ actorType: 'USER', actorId: user.id, action: `bulk.specialOrders.${op}`, entityType: 'SpecialOrder', entityId: `${ids.length} selected` });
  return r;
}

export async function bulkCustomers(op: string, ids: string[], value: string): Promise<BulkResult> {
  // Tier assignment is a pricing op; deletion is a stronger customer-write op.
  const user = await requirePermission(op === 'delete' ? 'customers.write' : 'pricing.manage');
  if (ids.length === 0) return empty();
  const r = empty();
  switch (op) {
    case 'tier': {
      const tierId = value && value !== '__none__' ? value : null;
      r.affected = (await prisma.customer.updateMany({ where: { id: { in: ids } }, data: { tierId } })).count;
      break;
    }
    case 'delete': {
      // Guarded: only customers with ZERO orders. Deleting the User cascades the
      // Customer + its addresses/wishlists/etc.; any FK-linked record is skipped.
      for (const id of ids) {
        const c = await prisma.customer.findUnique({ where: { id }, select: { userId: true, _count: { select: { orders: true } } } });
        if (!c || c._count.orders > 0) { r.skipped++; continue; }
        try { await prisma.user.delete({ where: { id: c.userId } }); r.affected++; } catch { r.skipped++; }
      }
      break;
    }
    default:
      throw new Error('BAD_OP');
  }
  await audit({ actorType: 'USER', actorId: user.id, action: `bulk.customers.${op}`, entityType: 'Customer', entityId: `${ids.length} selected` });
  return r;
}
