'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { SETTINGS, saveSettings } from '@/lib/settings-service';

const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');

export async function saveSettingsAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const values: Record<string, string> = {};
  for (const s of SETTINGS) {
    const v = fd.get(s.key);
    if (typeof v === 'string') values[s.key] = v.trim();
  }
  try {
    await saveSettings(values);
  } catch (e) {
    console.error('settings save failed', e);
    revalidatePath(`/${locale}/admin/settings`);
    redirect(`/${locale}/admin/settings?error=1`);
  }
  revalidatePath(`/${locale}/admin/settings`);
  redirect(`/${locale}/admin/settings?saved=1`);
}
