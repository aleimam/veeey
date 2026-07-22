'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { saveCity, deleteCity } from '@/lib/city-service';
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
      nameAr: str(fd, 'nameAr') ?? null,
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
      nameAr: str(fd, 'nameAr') ?? null,
      etaMinDays: str(fd, 'etaMinDays') ?? null,
      etaMaxDays: str(fd, 'etaMaxDays') ?? null,
      etaText: str(fd, 'etaText') ?? null,
      allowsUltraFast: fd.get('allowsUltraFast') != null,
      allowsPos: fd.get('allowsPos') != null,
    });
  } catch (e) { console.error('area save failed', e); }
  revalidatePath(`/${locale}/admin/shipping/zones/${zoneId}`);
  redirect(`/${locale}/admin/shipping/zones/${zoneId}`);
}

/** Save-all for a zone's sub-areas (V4 E27): every row's inputs are namespaced
 *  `<field>__<areaId>` and associated to one form via the `form=` attribute. */
export async function saveAreasAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const zoneId = str(fd, 'zoneId') ?? '';
  const ids = fd.getAll('areaIds').filter((v): v is string => typeof v === 'string' && v !== '');
  let failed = 0;
  for (const id of ids) {
    const name = str(fd, `name__${id}`);
    if (!name) continue;
    try {
      await saveArea(id, {
        zoneId,
        name,
        nameAr: str(fd, `nameAr__${id}`) ?? null,
        etaMinDays: str(fd, `etaMinDays__${id}`) ?? null,
        etaMaxDays: str(fd, `etaMaxDays__${id}`) ?? null,
        etaText: str(fd, `etaText__${id}`) ?? null,
        allowsUltraFast: fd.get(`allowsUltraFast__${id}`) != null,
        allowsPos: fd.get(`allowsPos__${id}`) != null,
      });
    } catch (e) {
      failed += 1;
      console.error('area save-all row failed', id, e);
    }
  }
  revalidatePath(`/${locale}/admin/shipping/zones/${zoneId}`);
  redirect(`/${locale}/admin/shipping/zones/${zoneId}?saved=${ids.length - failed}${failed ? `&failed=${failed}` : ''}`);
}

export async function deleteAreaAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  const zoneId = str(fd, 'zoneId') ?? '';
  if (id) { try { await deleteArea(id); } catch (e) { console.error('area delete failed', e); } }
  revalidatePath(`/${locale}/admin/shipping/zones/${zoneId}`);
  redirect(`/${locale}/admin/shipping/zones/${zoneId}`);
}

/* ---- Delivery districts (owner 2026-07-23) ------------------------------- */

export async function saveCityAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  try {
    await saveCity(str(fd, 'id') ?? null, {
      governorate: str(fd, 'governorate') ?? '',
      nameEn: str(fd, 'nameEn') ?? '',
      nameAr: str(fd, 'nameAr') ?? '',
      active: fd.get('active') != null,
      sortOrder: str(fd, 'sortOrder') ?? '0',
    });
  } catch (e) {
    // CITY_EXISTS is the one an admin can act on — the rest are bugs.
    const err = e instanceof Error && e.message === 'CITY_EXISTS' ? 'exists' : 'invalid';
    revalidatePath(`/${locale}/admin/shipping/cities`);
    redirect(`/${locale}/admin/shipping/cities?error=${err}&gov=${encodeURIComponent(str(fd, 'governorate') ?? '')}`);
  }
  back(locale, `shipping/cities?gov=${encodeURIComponent(str(fd, 'governorate') ?? '')}&saved=1`);
}

export async function deleteCityAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  if (id) await deleteCity(id);
  back(locale, `shipping/cities?gov=${encodeURIComponent(str(fd, 'governorate') ?? '')}`);
}
