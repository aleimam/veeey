'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createReturnReason, updateReturnReason, setReturnReasonActive } from '@/lib/return-reason-service';

const str = (fd: FormData, k: string) => ((fd.get(k) as string | null) ?? '').trim();

export async function saveReturnReasonAction(fd: FormData): Promise<void> {
  const locale = fd.get('locale') === 'ar' ? 'ar' : 'en';
  const id = str(fd, 'id');
  const input = {
    labelEn: str(fd, 'labelEn'),
    labelAr: str(fd, 'labelAr'),
    sortOrder: Number(str(fd, 'sortOrder') || '0'),
    requiresDetail: fd.get('requiresDetail') != null,
  };
  if (id) await updateReturnReason(id, input);
  else await createReturnReason(input);
  revalidatePath(`/${locale}/admin/returns/reasons`);
  redirect(`/${locale}/admin/returns/reasons`);
}

export async function toggleReturnReasonAction(fd: FormData): Promise<void> {
  const locale = fd.get('locale') === 'ar' ? 'ar' : 'en';
  const id = str(fd, 'id');
  if (id) await setReturnReasonActive(id, str(fd, 'active') === 'true');
  revalidatePath(`/${locale}/admin/returns/reasons`);
  redirect(`/${locale}/admin/returns/reasons`);
}
