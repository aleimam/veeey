'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { approveShipment, rejectShipment } from '@/lib/incoming-shipment-service';

const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');
const str = (fd: FormData, k: string) => { const v = fd.get(k); return typeof v === 'string' ? v.trim() : ''; };
const PATH = (l: string, id: string) => `/${l}/admin/inventory/incoming/${id}`;

export async function approveShipmentAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  if (!id) redirect(`/${locale}/admin/inventory/incoming`);
  const r = await approveShipment(id);
  revalidatePath(PATH(locale, id));
  revalidatePath(`/${locale}/admin/inventory/incoming`);
  redirect(r.ok ? `${PATH(locale, id)}?approved=1` : `${PATH(locale, id)}?error=${r.error}`);
}

export async function rejectShipmentAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  if (!id) redirect(`/${locale}/admin/inventory/incoming`);
  const r = await rejectShipment(id, str(fd, 'reason'));
  revalidatePath(PATH(locale, id));
  revalidatePath(`/${locale}/admin/inventory/incoming`);
  redirect(r.ok ? `${PATH(locale, id)}?rejected=1` : `${PATH(locale, id)}?error=${r.error}`);
}
