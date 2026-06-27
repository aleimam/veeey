'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { saveSystemMethod, setSystemMethodActive, deleteSystemMethod, remapOrderPayments } from '@/lib/payment-method-service';
import { InUseError } from '@/lib/soft-delete-service';

const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');
const str = (fd: FormData, k: string) => { const v = fd.get(k); return typeof v === 'string' ? v.trim() : ''; };
const PATH = (l: string) => `/${l}/admin/payments`;

/** Aliases come in as one CSV/newline-separated textarea. */
const parseAliases = (raw: string) => raw.split(/[\n,]/).map((a) => a.trim().toLowerCase()).filter(Boolean);

export async function saveSystemMethodAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  try {
    await saveSystemMethod(str(fd, 'id') || null, {
      code: str(fd, 'code'),
      labelEn: str(fd, 'labelEn'),
      labelAr: str(fd, 'labelAr') || null,
      customerCode: str(fd, 'customerCode'),
      courier: str(fd, 'courier') || null,
      sourceAliases: parseAliases(str(fd, 'sourceAliases')),
      active: fd.get('active') != null,
      sortOrder: Number(str(fd, 'sortOrder')) || 0,
    });
  } catch (e) {
    console.error('save system payment method failed', e);
    revalidatePath(PATH(locale));
    redirect(`${PATH(locale)}?error=1`);
  }
  revalidatePath(PATH(locale));
  redirect(`${PATH(locale)}?saved=1`);
}

export async function toggleSystemMethodAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  try { await setSystemMethodActive(str(fd, 'id'), fd.get('active') === '1'); } catch (e) { console.error(e); }
  revalidatePath(PATH(locale));
  redirect(PATH(locale));
}

export async function deleteSystemMethodAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  try {
    await deleteSystemMethod(str(fd, 'id'));
  } catch (e) {
    revalidatePath(PATH(locale));
    redirect(`${PATH(locale)}?error=${e instanceof InUseError ? 'in_use' : '1'}`);
  }
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
