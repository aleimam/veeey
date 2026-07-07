'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { saveGoogleConfig } from '@/lib/google-service';

const str = (fd: FormData, k: string) => (typeof fd.get(k) === 'string' ? (fd.get(k) as string) : '');

export async function saveGoogleAction(fd: FormData): Promise<void> {
  const locale = str(fd, 'locale') || 'en';
  await saveGoogleConfig({
    ga4Id: str(fd, 'ga4Id'),
    gtmId: str(fd, 'gtmId'),
    searchConsole: str(fd, 'searchConsole'),
    adsId: str(fd, 'adsId'),
  });
  revalidatePath('/', 'layout'); // tags render in the root layout
  redirect(`/${locale}/admin/google?saved=1`);
}
