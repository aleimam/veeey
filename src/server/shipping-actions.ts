'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  updateShippingType,
  saveZone,
  deleteZone,
  saveArea,
  deleteArea,
  type ShippingTypeKey,
} from '@/lib/shipping-service';

const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');
const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};

function back(locale: string, path: string): never {
  revalidatePath(`/${locale}/admin/${path}`);
  redirect(`/${locale}/admin/${path}`);
}

export async function updateShippingTypeAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const type = str(fd, 'type') as ShippingTypeKey | undefined;
  if (type) {
    try {
      await updateShippingType(type, {
        labelEn: str(fd, 'labelEn') ?? '',
        labelAr: str(fd, 'labelAr') ?? '',
        feeEgp: str(fd, 'feeEgp') ?? '0',
        enabled: fd.get('enabled') != null,
      });
    } catch (e) { console.error('shipping type update failed', e); }
  }
  back(locale, 'shipping');
}

export async function saveZoneAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  try {
    await saveZone(str(fd, 'id') ?? null, {
      name: str(fd, 'name') ?? '',
      governorate: str(fd, 'governorate') ?? '',
      granularity: (str(fd, 'granularity') ?? 'GOVERNORATE') as 'AREA' | 'GOVERNORATE',
    });
  } catch (e) { console.error('zone save failed', e); }
  back(locale, 'shipping');
}

export async function deleteZoneAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  if (id) { try { await deleteZone(id); } catch (e) { console.error('zone delete failed', e); } }
  back(locale, 'shipping');
}

export async function saveAreaAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const zoneId = str(fd, 'zoneId') ?? '';
  try {
    await saveArea(str(fd, 'id') ?? null, {
      zoneId,
      name: str(fd, 'name') ?? '',
      etaText: str(fd, 'etaText') ?? null,
      allowsUltraFast: fd.get('allowsUltraFast') != null,
    });
  } catch (e) { console.error('area save failed', e); }
  revalidatePath(`/${locale}/admin/shipping/zones/${zoneId}`);
  redirect(`/${locale}/admin/shipping/zones/${zoneId}`);
}

export async function deleteAreaAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  const zoneId = str(fd, 'zoneId') ?? '';
  if (id) { try { await deleteArea(id); } catch (e) { console.error('area delete failed', e); } }
  revalidatePath(`/${locale}/admin/shipping/zones/${zoneId}`);
  redirect(`/${locale}/admin/shipping/zones/${zoneId}`);
}
