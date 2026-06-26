'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { deleteCyrillicJunk, type JunkDeleteResult } from '@/lib/admin-cleanup-service';

const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');

export async function deleteCyrillicJunkAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const path = `/${locale}/admin/woocommerce/cleanup`;
  let res: JunkDeleteResult | null = null;
  try {
    res = await deleteCyrillicJunk({ budgetMs: 45_000 });
  } catch (e) {
    console.error('cyrillic cleanup failed', e);
    revalidatePath(path);
    redirect(`${path}?error=1`);
  }
  if (!res) return;
  revalidatePath(path);
  redirect(`${path}?rev=${res.reviews}&cust=${res.customers}&custKept=${res.customersKept}&prod=${res.products}&prodKept=${res.productsKept}&done=${res.done ? 1 : 0}`);
}
