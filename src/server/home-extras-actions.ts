'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  saveTestimonial, deleteTestimonial,
  saveTrustBadge, deleteTrustBadge,
} from '@/lib/home-extras-service';
import type { AdminFormState } from '@/server/admin-actions';

const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');
const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};
function fail(e: unknown): AdminFormState {
  if (e instanceof Error && e.message === 'FORBIDDEN') return { error: 'forbidden' };
  console.error('home-extras action failed', e);
  return { error: 'invalid' };
}

export async function saveTestimonialAction(_p: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const locale = localeOf(fd);
  try {
    await saveTestimonial(str(fd, 'id') ?? null, {
      quoteEn: str(fd, 'quoteEn') ?? '', quoteAr: str(fd, 'quoteAr') ?? null,
      name: str(fd, 'name') ?? '', location: str(fd, 'location') ?? null,
      sortOrder: str(fd, 'sortOrder') ?? '0', active: fd.get('active') != null,
    });
  } catch (e) { return fail(e); }
  revalidatePath(`/${locale}/admin/homepage/testimonials`);
  redirect(`/${locale}/admin/homepage/testimonials`);
}

export async function deleteTestimonialAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  if (id) { try { await deleteTestimonial(id); } catch (e) { fail(e); } }
  revalidatePath(`/${locale}/admin/homepage/testimonials`);
  redirect(`/${locale}/admin/homepage/testimonials`);
}

export async function saveTrustBadgeAction(_p: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const locale = localeOf(fd);
  try {
    await saveTrustBadge(str(fd, 'id') ?? null, {
      labelEn: str(fd, 'labelEn') ?? '', labelAr: str(fd, 'labelAr') ?? null,
      sortOrder: str(fd, 'sortOrder') ?? '0', active: fd.get('active') != null,
    });
  } catch (e) { return fail(e); }
  revalidatePath(`/${locale}/admin/homepage/trust`);
  redirect(`/${locale}/admin/homepage/trust`);
}

export async function deleteTrustBadgeAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  if (id) { try { await deleteTrustBadge(id); } catch (e) { fail(e); } }
  revalidatePath(`/${locale}/admin/homepage/trust`);
  redirect(`/${locale}/admin/homepage/trust`);
}
