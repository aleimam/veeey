'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { saveSocialLink, deleteSocialLink } from '@/lib/social-service';
import type { AdminFormState } from '@/server/admin-actions';

const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');
const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};

function fail(e: unknown): AdminFormState {
  if (e instanceof Error && e.message === 'FORBIDDEN') return { error: 'forbidden' };
  console.error('social action failed', e);
  return { error: 'invalid' };
}

export async function saveSocialLinkAction(_p: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const locale = localeOf(fd);
  try {
    await saveSocialLink(str(fd, 'id') ?? null, {
      platform: str(fd, 'platform') ?? 'other',
      label: str(fd, 'label') ?? null,
      url: str(fd, 'url') ?? '',
      sortOrder: str(fd, 'sortOrder') ?? '0',
      active: fd.get('active') != null,
    });
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/${locale}/admin/social`);
  redirect(`/${locale}/admin/social`);
}

export async function deleteSocialLinkAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  if (id) {
    try { await deleteSocialLink(id); } catch (e) { fail(e); }
  }
  revalidatePath(`/${locale}/admin/social`);
  redirect(`/${locale}/admin/social`);
}
