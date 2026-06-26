'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { syncProducts, syncCustomers, syncOrders, type SyncSummary } from '@/lib/migration/wc-sync';
import { saveSyncSettings } from '@/lib/woocommerce-service';

const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');
const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' ? v : '';
};
const PATH = (l: string) => `/${l}/admin/woocommerce/sync`;

async function run(entity: string, fn: (o: { maxPages: number }) => Promise<SyncSummary>, fd: FormData) {
  const locale = localeOf(fd);
  const pages = Math.min(80, Math.max(1, Number(fd.get('pages')) || 5));
  const user = await requirePermission('settings.manage');
  let summary: SyncSummary | null = null;
  try {
    summary = await fn({ maxPages: pages });
  } catch (e) {
    console.error(`woo sync ${entity} failed`, e);
    revalidatePath(PATH(locale));
    redirect(`${PATH(locale)}?error=1`);
  }
  if (!summary) return;
  await audit({ actorType: 'USER', actorId: user.id, action: `woo.sync.${entity}`, entityType: 'WooSyncState', entityId: entity });
  revalidatePath(PATH(locale));
  const q = `ran=${entity}&scanned=${summary.scanned}&created=${summary.created}&updated=${summary.updated}&detached=${summary.detached}&skipped=${summary.skipped}&errors=${summary.errors}`;
  redirect(`${PATH(locale)}?${q}`);
}

export async function syncProductsAction(fd: FormData): Promise<void> {
  return run('products', syncProducts, fd);
}
export async function syncCustomersAction(fd: FormData): Promise<void> {
  return run('customers', syncCustomers, fd);
}
export async function syncOrdersAction(fd: FormData): Promise<void> {
  return run('orders', syncOrders, fd);
}

export async function saveSyncSettingsAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  try {
    await saveSyncSettings({
      'woo.sync.enabled': fd.get('enabled') != null ? 'true' : 'false',
      'woo.sync.products': fd.get('p') != null ? 'true' : 'false',
      'woo.sync.customers': fd.get('c') != null ? 'true' : 'false',
      'woo.sync.orders': fd.get('o') != null ? 'true' : 'false',
      'woo.webhookSecret': str(fd, 'webhookSecret'),
    });
  } catch (e) {
    console.error('woo sync settings failed', e);
    revalidatePath(PATH(locale));
    redirect(`${PATH(locale)}?error=1`);
  }
  revalidatePath(PATH(locale));
  redirect(`${PATH(locale)}?settings=1`);
}
