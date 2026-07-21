'use server';

import { revalidatePath } from 'next/cache';
import { recordSpillage, voidSpillage, saveSpillageReason, deleteSpillageReason } from '@/lib/spillage-service';
import { egpToPiastres } from '@/lib/format';

const str = (fd: FormData, k: string) => (fd.get(k) ? String(fd.get(k)).trim() : '');
const localeOf = (fd: FormData) => (str(fd, 'locale') === 'ar' ? 'ar' : 'en');
const reval = (locale: string) => revalidatePath(`/${locale}/admin/inventory/spillage`);

export async function recordSpillageAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const lotId = str(fd, 'lotId');
  const reasonCode = str(fd, 'reasonCode');
  const qty = Number(str(fd, 'qty'));
  const priceEgp = str(fd, 'priceEgp');
  if (lotId && reasonCode && qty > 0) {
    try {
      await recordSpillage({
        lotId, reasonCode, qty,
        variantPricePiastres: priceEgp ? Number(egpToPiastres(Number(priceEgp))) : null,
        note: str(fd, 'note') || null,
      });
    } catch (e) { console.error('recordSpillage failed', e); }
  }
  reval(locale);
}

export async function voidSpillageAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  if (id) {
    try { await voidSpillage(id); } catch (e) { console.error('voidSpillage failed', e); }
  }
  reval(locale);
}

export async function saveSpillageReasonAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  try {
    await saveSpillageReason({
      id: str(fd, 'id') || undefined,
      code: str(fd, 'code'),
      labelEn: str(fd, 'labelEn'),
      labelAr: str(fd, 'labelAr') || null,
      sellable: fd.get('sellable') === 'on' || fd.get('sellable') === 'true',
      active: fd.get('active') !== 'off' && fd.get('active') !== 'false',
      sortOrder: Number(str(fd, 'sortOrder')) || 0,
    });
  } catch (e) { console.error('saveSpillageReason failed', e); }
  reval(locale);
}

export async function deleteSpillageReasonAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  if (id) {
    try { await deleteSpillageReason(id); } catch (e) { console.error('deleteSpillageReason failed', e); }
  }
  reval(locale);
}
