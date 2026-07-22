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
  if (!r.ok) redirect(`${PATH(locale, id)}?error=${r.error}`);
  // Carry what approval actually did — units that could not be booked, or a cost
  // converted at a stale rate, are exactly what the approver must be told about
  // and would otherwise be buried in the audit log.
  const q = new URLSearchParams({ approved: '1', units: String(r.stocked.units), lots: String(r.stocked.lotsStocked) });
  if (r.stocked.skippedUnmatched) q.set('unstocked', String(r.stocked.skippedUnmatched));
  if (r.stocked.staleFx) q.set('stale', String(r.stocked.staleFx));
  if (r.stocked.noRate) q.set('norate', String(r.stocked.noRate));
  if (r.stocked.costConflicts) q.set('costclash', String(r.stocked.costConflicts));
  redirect(`${PATH(locale, id)}?${q}`);
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
