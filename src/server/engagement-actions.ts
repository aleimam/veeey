'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth-guards';
import { toggleWishlist, setItemAlerts } from '@/lib/wishlist-service';
import { ensureCompareId, toggleCompare } from '@/lib/compare-service';

const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');
const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};

export async function toggleWishlistAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const productId = str(fd, 'productId');
  const back = str(fd, 'back') ?? '/products';
  const user = await getCurrentUser();
  if (!user?.customerId) redirect(`/${locale}/login`);
  if (user?.customerId && productId) await toggleWishlist(user.customerId, productId);
  revalidatePath(`/${locale}${back}`);
  redirect(`/${locale}${back}`);
}

export async function toggleCompareAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const productId = str(fd, 'productId');
  const back = str(fd, 'back') ?? '/compare';
  const compareId = await ensureCompareId();
  if (productId) await toggleCompare(compareId, productId);
  revalidatePath(`/${locale}${back}`);
  redirect(`/${locale}${back}`);
}

export async function setWishlistAlertsAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const itemId = str(fd, 'itemId');
  if (itemId) await setItemAlerts(itemId, fd.get('notifyPriceDrop') != null, fd.get('notifyBackInStock') != null);
  revalidatePath(`/${locale}/wishlist`);
  redirect(`/${locale}/wishlist`);
}
