import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { deleteProduct, InUseError } from '@/lib/soft-delete-service';
import { transitionOrder } from '@/lib/order-service';
import type { OrderStatus } from '@/lib/order-status';

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
    case 'delete': {
      for (const id of ids) {
        try { await deleteProduct(id); r.affected++; } catch (e) { if (e instanceof InUseError) r.skipped++; else r.skipped++; }
      }
      break;
    }
    default:
      throw new Error('BAD_OP');
  }
  await audit({ actorType: 'USER', actorId: user.id, action: `bulk.products.${op}`, entityType: 'Product', entityId: `${ids.length} selected` });
  return r;
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
    default:
      throw new Error('BAD_OP');
  }
  await audit({ actorType: 'USER', actorId: user.id, action: `bulk.orders.${op}`, entityType: 'Order', entityId: `${ids.length} selected` });
  return r;
}

export async function bulkCustomers(op: string, ids: string[], value: string): Promise<BulkResult> {
  const user = await requirePermission('pricing.manage');
  if (ids.length === 0) return empty();
  const r = empty();
  switch (op) {
    case 'tier': {
      const tierId = value && value !== '__none__' ? value : null;
      r.affected = (await prisma.customer.updateMany({ where: { id: { in: ids } }, data: { tierId } })).count;
      break;
    }
    default:
      throw new Error('BAD_OP');
  }
  await audit({ actorType: 'USER', actorId: user.id, action: `bulk.customers.${op}`, entityType: 'Customer', entityId: `${ids.length} selected` });
  return r;
}
