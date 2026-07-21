'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { saveStatusConfig, remapOrderStatuses } from '@/lib/order-status-service';

const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');
const str = (fd: FormData, k: string) => { const v = fd.get(k); return typeof v === 'string' ? v.trim() : ''; };
const PATH = (l: string) => `/${l}/admin/order-statuses`;
const parseAliases = (raw: string) => raw.split(/[\n,]/).map((a) => a.trim().toLowerCase()).filter(Boolean);

export async function saveStatusConfigAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  try {
    await saveStatusConfig(str(fd, 'code'), {
      labelEn: str(fd, 'labelEn'),
      labelAr: str(fd, 'labelAr') || null,
      customerCode: str(fd, 'customerCode') || null,
      icon: str(fd, 'icon') || 'circle',
      stockEffect: str(fd, 'stockEffect') || 'none',
      paymentEffect: str(fd, 'paymentEffect') || 'none',
      revenueEffect: str(fd, 'revenueEffect') || 'none',
      loyaltyEffect: str(fd, 'loyaltyEffect') || 'none',
      notifyAudience: str(fd, 'notifyAudience') || 'none',
      notifyTemplateKey: str(fd, 'notifyTemplateKey') || null,
      advancePermission: str(fd, 'advancePermission') || null,
      fastAction: fd.get('fastAction') != null,
      allowedNext: fd.getAll('allowedNext').map((v) => String(v)),
      sourceAliases: parseAliases(str(fd, 'sourceAliases')),
      sortOrder: Number(str(fd, 'sortOrder')) || 0,
      active: fd.get('active') != null,
    });
  } catch (e) {
    console.error('save status config failed', e);
    revalidatePath(PATH(locale));
    redirect(`${PATH(locale)}?error=1`);
  }
  revalidatePath(PATH(locale));
  redirect(`${PATH(locale)}?saved=1`);
}

export async function remapOrderStatusesAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  let n = 0;
  try { n = await remapOrderStatuses(); } catch (e) { console.error(e); revalidatePath(PATH(locale)); redirect(`${PATH(locale)}?error=1`); }
  revalidatePath(PATH(locale));
  redirect(`${PATH(locale)}?remapped=${n}`);
}
