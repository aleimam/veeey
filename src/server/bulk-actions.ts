'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { bulkProducts, bulkOrders, bulkCustomers, type BulkResult } from '@/lib/admin-bulk-service';
import { bulkSoftDelete } from '@/lib/soft-delete-service';

const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');
const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' ? v : '';
};
const idsOf = (fd: FormData) => fd.getAll('ids').filter((v): v is string => typeof v === 'string' && v !== '');

/** The list URL to return to: the page's own path+query (so filters/sort/page survive). */
function backTo(fd: FormData, locale: string, fallback: string): string {
  const b = str(fd, 'back');
  return b.startsWith(`/${locale}/admin/`) ? b : `/${locale}/admin/${fallback}`;
}
function finish(target: string, r: BulkResult): never {
  const sep = target.includes('?') ? '&' : '?';
  redirect(`${target}${sep}done=${r.affected}&skip=${r.skipped}`);
}
function fail(target: string): never {
  const sep = target.includes('?') ? '&' : '?';
  redirect(`${target}${sep}error=bulk`);
}

export async function bulkProductsAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const target = backTo(fd, locale, 'products');
  let r: BulkResult | null = null;
  try {
    r = await bulkProducts(str(fd, 'op'), idsOf(fd), str(fd, 'value'));
  } catch (e) {
    console.error('bulk products failed', e);
    revalidatePath(`/${locale}/admin/products`);
    fail(target);
  }
  if (!r) return;
  revalidatePath(`/${locale}/admin/products`);
  finish(target, r);
}

export async function bulkOrdersAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const target = backTo(fd, locale, 'orders');
  let r: BulkResult | null = null;
  try {
    r = await bulkOrders(str(fd, 'op'), idsOf(fd), str(fd, 'value'));
  } catch (e) {
    console.error('bulk orders failed', e);
    revalidatePath(`/${locale}/admin/orders`);
    fail(target);
  }
  if (!r) return;
  revalidatePath(`/${locale}/admin/orders`);
  finish(target, r);
}

/** Generic archive/restore/delete for AdminList entities (brand, category, tag,
 *  attribute, coupon, gift, collection, page, post). `entity` + `path` come from
 *  hidden fields; the op-select supplies archive|restore|delete. */
export async function bulkSoftDeleteAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const entity = str(fd, 'entity');
  const path = str(fd, 'path') || `${entity}s`;
  const op = str(fd, 'op');
  const target = backTo(fd, locale, path);
  let r: BulkResult | null = null;
  try {
    r = await bulkSoftDelete(entity, op as 'archive' | 'restore' | 'delete', idsOf(fd));
  } catch (e) {
    console.error('bulk soft-delete failed', e);
    revalidatePath(`/${locale}/admin/${path}`);
    fail(target);
  }
  if (!r) return;
  revalidatePath(`/${locale}/admin/${path}`);
  finish(target, r);
}

export async function bulkCustomersAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const target = backTo(fd, locale, 'customers');
  let r: BulkResult | null = null;
  try {
    r = await bulkCustomers(str(fd, 'op'), idsOf(fd), str(fd, 'value'));
  } catch (e) {
    console.error('bulk customers failed', e);
    revalidatePath(`/${locale}/admin/customers`);
    fail(target);
  }
  if (!r) return;
  revalidatePath(`/${locale}/admin/customers`);
  finish(target, r);
}
