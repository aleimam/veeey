'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { saveBranding } from '@/lib/branding-service';

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' ? v : '';
};

export async function saveBrandingAction(fd: FormData): Promise<void> {
  const locale = fd.get('locale') === 'ar' ? 'ar' : 'en';
  await saveBranding({
    siteNameEn: str(fd, 'siteNameEn'),
    siteNameAr: str(fd, 'siteNameAr'),
    titleEn: str(fd, 'titleEn'),
    titleAr: str(fd, 'titleAr'),
    logoUrl: str(fd, 'logoUrl'),
    logoLightUrl: str(fd, 'logoLightUrl'),
    faviconUrl: str(fd, 'faviconUrl'),
  });
  revalidatePath('/', 'layout');
  redirect(`/${locale}/admin/branding?saved=1`);
}
