'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import {
  ignoreProduct,
  unignoreProduct,
  createPurchaseRequest,
  suggestedQtyFor,
} from '@/lib/inventory-reorder-service';

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};
const idList = (fd: FormData) => fd.getAll('ids').filter((v): v is string => typeof v === 'string' && v !== '');

function listPath(fd: FormData): string {
  const b = str(fd, 'back');
  const locale = fd.get('locale') === 'ar' ? 'ar' : 'en';
  return b && b.startsWith('/') ? b : `/${locale}/admin/inventory/requests`;
}
const withFlag = (path: string, flag: string) => `${path}${path.includes('?') ? '&' : '?'}${flag}`;

/** Run the mutation, then always redirect back to the list with a status flag (redirect stays outside try). */
async function finish(path: string, work: () => Promise<void>): Promise<void> {
  let flag = 'done=1';
  try {
    await work();
  } catch (e) {
    if (e instanceof Error && e.message === 'FORBIDDEN') flag = 'error=forbidden';
    else if (e instanceof Error && e.message === 'INVALID') flag = 'error=invalid';
    else {
      console.error('reorder action failed', e);
      flag = 'error=1';
    }
  }
  revalidatePath(path.split('?')[0]);
  redirect(withFlag(path, flag));
}

// ---- Request to buy --------------------------------------------------------

export async function requestToBuyAction(fd: FormData): Promise<void> {
  const path = listPath(fd);
  await finish(path, async () => {
    const user = await requirePermission('inventory.manage');
    const productId = str(fd, 'productId');
    const qty = Math.floor(Number(str(fd, 'qty') ?? '0'));
    if (!productId || !Number.isFinite(qty) || qty < 1) throw new Error('INVALID');
    const reqId = await createPurchaseRequest(productId, qty, { id: user.id, name: user.name ?? null }, str(fd, 'note'));
    await audit({ actorType: 'USER', actorId: user.id, action: 'inventory.request.create', entityType: 'PurchaseRequest', entityId: reqId, data: { productId, qty } });
  });
}

export async function bulkRequestAction(fd: FormData): Promise<void> {
  const path = listPath(fd);
  await finish(path, async () => {
    const user = await requirePermission('inventory.manage');
    const ids = idList(fd);
    if (ids.length === 0) throw new Error('INVALID');
    let created = 0;
    for (const productId of ids) {
      const qty = await suggestedQtyFor(productId);
      await createPurchaseRequest(productId, qty, { id: user.id, name: user.name ?? null });
      created += 1;
    }
    await audit({ actorType: 'USER', actorId: user.id, action: 'inventory.request.bulk', entityType: 'PurchaseRequest', data: { count: created } });
  });
}

// ---- Ignore / restore ------------------------------------------------------

export async function ignoreAction(fd: FormData): Promise<void> {
  const path = listPath(fd);
  await finish(path, async () => {
    const user = await requirePermission('inventory.manage');
    const productId = str(fd, 'productId');
    if (!productId) throw new Error('INVALID');
    await ignoreProduct(productId, { id: user.id, name: user.name ?? null }, str(fd, 'reason'));
    await audit({ actorType: 'USER', actorId: user.id, action: 'inventory.reorder.ignore', entityType: 'Product', entityId: productId });
  });
}

export async function bulkIgnoreAction(fd: FormData): Promise<void> {
  const path = listPath(fd);
  await finish(path, async () => {
    const user = await requirePermission('inventory.manage');
    const ids = idList(fd);
    if (ids.length === 0) throw new Error('INVALID');
    for (const productId of ids) await ignoreProduct(productId, { id: user.id, name: user.name ?? null });
    await audit({ actorType: 'USER', actorId: user.id, action: 'inventory.reorder.ignore.bulk', entityType: 'Product', data: { count: ids.length } });
  });
}

export async function unignoreAction(fd: FormData): Promise<void> {
  const path = listPath(fd);
  await finish(path, async () => {
    const user = await requirePermission('inventory.manage');
    const productId = str(fd, 'productId');
    if (!productId) throw new Error('INVALID');
    await unignoreProduct(productId);
    await audit({ actorType: 'USER', actorId: user.id, action: 'inventory.reorder.unignore', entityType: 'Product', entityId: productId });
  });
}

// ---- Expiry Fight: fast per-lot price markdown -----------------------------

export async function setExpiryPriceAction(fd: FormData): Promise<void> {
  const path = listPath(fd);
  await finish(path, async () => {
    const lotId = str(fd, 'lotId');
    const egp = Number(str(fd, 'egp') ?? '');
    if (!lotId || !Number.isFinite(egp) || egp < 0) throw new Error('INVALID');
    // setLotPrice enforces inventory.manage, sets the per-expiry price, flags the
    // lot on sale, emits a SALE_LOT change event, and audits.
    const { setLotPrice } = await import('@/lib/inventory-service');
    await setLotPrice(lotId, egp, true);
  });
}
