'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { saveGiftRule, setGiftRuleActive, deleteGiftRule } from '@/lib/gift-rule-service';

const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');
const str = (fd: FormData, k: string): string | undefined => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};

function back(locale: string, flag?: string): never {
  revalidatePath(`/${locale}/admin/gifts/rules`);
  redirect(`/${locale}/admin/gifts/rules${flag ? `?${flag}` : ''}`);
}

export async function saveGiftRuleAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  try {
    await saveGiftRule(str(fd, 'id') ?? null, {
      nameEn: str(fd, 'nameEn') ?? '',
      nameAr: str(fd, 'nameAr') ?? null,
      giftId: str(fd, 'giftId') ?? '',
      giftQty: Number(str(fd, 'giftQty') ?? '1') || 1,
      minSubtotalEgp: str(fd, 'minSubtotalEgp') ? Number(str(fd, 'minSubtotalEgp')) : null,
      productSku: str(fd, 'productSku') ?? null,
      categoryId: str(fd, 'categoryId') ?? null,
      startsAt: str(fd, 'startsAt') ? new Date(str(fd, 'startsAt')!) : null,
      endsAt: str(fd, 'endsAt') ? new Date(`${str(fd, 'endsAt')}T23:59:59`) : null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'invalid';
    const flag = msg === 'SKU_NOT_FOUND' ? 'error=sku' : msg === 'NO_CONDITIONS' ? 'error=conditions' : msg === 'FORBIDDEN' ? 'error=forbidden' : 'error=invalid';
    console.error('saveGiftRule failed', e);
    back(locale, flag);
  }
  back(locale, 'done=1');
}

export async function toggleGiftRuleAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  if (id) {
    try { await setGiftRuleActive(id, fd.get('active') === '1'); } catch (e) { console.error(e); }
  }
  back(locale);
}

export async function deleteGiftRuleAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  if (id) {
    try { await deleteGiftRule(id); } catch (e) { console.error(e); }
  }
  back(locale);
}
