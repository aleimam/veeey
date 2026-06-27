'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { savePaymentMethod, setPaymentMethodActive, deletePaymentMethod, savePaymentMap, remapOrderPayments } from '@/lib/payment-method-service';
import { InUseError } from '@/lib/soft-delete-service';

const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');
const str = (fd: FormData, k: string) => { const v = fd.get(k); return typeof v === 'string' ? v.trim() : ''; };
const PATH = (l: string) => `/${l}/admin/payments`;

export async function savePaymentMethodAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  try {
    await savePaymentMethod(str(fd, 'id') || null, {
      code: str(fd, 'code'),
      labelEn: str(fd, 'labelEn'),
      labelAr: str(fd, 'labelAr') || null,
      active: fd.get('active') != null,
      sortOrder: Number(str(fd, 'sortOrder')) || 0,
      instructionsEn: str(fd, 'instructionsEn') || null,
      instructionsAr: str(fd, 'instructionsAr') || null,
    });
  } catch (e) {
    console.error('save payment method failed', e);
    revalidatePath(PATH(locale));
    redirect(`${PATH(locale)}?error=1`);
  }
  revalidatePath(PATH(locale));
  redirect(`${PATH(locale)}?saved=1`);
}

export async function togglePaymentMethodAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  try { await setPaymentMethodActive(str(fd, 'id'), fd.get('active') === '1'); } catch (e) { console.error(e); }
  revalidatePath(PATH(locale));
  redirect(PATH(locale));
}

export async function deletePaymentMethodAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  try {
    await deletePaymentMethod(str(fd, 'id'));
  } catch (e) {
    revalidatePath(PATH(locale));
    redirect(`${PATH(locale)}?error=${e instanceof InUseError ? 'in_use' : '1'}`);
  }
  revalidatePath(PATH(locale));
  redirect(`${PATH(locale)}?saved=1`);
}

export async function savePaymentMapAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const wcs = fd.getAll('wc').map((v) => String(v));
  const methods = fd.getAll('method').map((v) => String(v));
  const map: Record<string, string> = {};
  wcs.forEach((w, i) => { const k = w.trim().toLowerCase(); if (k && methods[i]) map[k] = methods[i]; });
  try { await savePaymentMap(map); } catch (e) { console.error(e); revalidatePath(PATH(locale)); redirect(`${PATH(locale)}?error=1`); }
  revalidatePath(PATH(locale));
  redirect(`${PATH(locale)}?saved=1`);
}

export async function remapOrderPaymentsAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  let n = 0;
  try { n = await remapOrderPayments(); } catch (e) { console.error(e); revalidatePath(PATH(locale)); redirect(`${PATH(locale)}?error=1`); }
  revalidatePath(PATH(locale));
  redirect(`${PATH(locale)}?remapped=${n}`);
}
