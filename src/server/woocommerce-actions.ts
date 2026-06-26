'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { saveWooConfig, clearWooConfig } from '@/lib/woocommerce-service';

const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');
const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' ? v : '';
};
const PATH = (l: string) => `/${l}/admin/woocommerce`;

export async function saveWooConfigAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  try {
    await saveWooConfig({
      'woo.url': str(fd, 'url'),
      'woo.consumerKey': str(fd, 'consumerKey'),
      'woo.consumerSecret': str(fd, 'consumerSecret'),
    });
  } catch (e) {
    console.error('woo save failed', e);
    revalidatePath(PATH(locale));
    redirect(`${PATH(locale)}?error=1`);
  }
  revalidatePath(PATH(locale));
  redirect(`${PATH(locale)}?saved=1`);
}

export async function clearWooConfigAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  try {
    await clearWooConfig();
  } catch (e) {
    console.error('woo clear failed', e);
  }
  revalidatePath(PATH(locale));
  redirect(`${PATH(locale)}?cleared=1`);
}
