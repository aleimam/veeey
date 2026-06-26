'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { syncProducts } from '@/lib/migration/wc-sync';

const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');
const PATH = (l: string) => `/${l}/admin/woocommerce/sync`;

export async function syncProductsAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const pages = Math.min(50, Math.max(1, Number(fd.get('pages')) || 5));
  let summary: Awaited<ReturnType<typeof syncProducts>> | null = null;
  try {
    summary = await syncProducts({ maxPages: pages });
  } catch (e) {
    console.error('woo sync products failed', e);
    revalidatePath(PATH(locale));
    redirect(`${PATH(locale)}?error=1`);
  }
  if (!summary) return;
  revalidatePath(PATH(locale));
  redirect(`${PATH(locale)}?ran=products&scanned=${summary.scanned}&created=${summary.created}&updated=${summary.updated}&detached=${summary.detached}&errors=${summary.errors}`);
}
