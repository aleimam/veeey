'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { saveSystemMethod, setSystemMethodActive, deleteSystemMethod, remapOrderPayments, CUSTOMER_METHODS, invalidatePaymentCache } from '@/lib/payment-method-service';
import { paymentLogoKey } from '@/lib/payment-copy';
import { saveSettings } from '@/lib/settings-service';
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

/**
 * Save the uploaded per-method checkout logos. The uploaders keep each URL in a
 * hidden input named by the method code; here we map those to their settings
 * keys and persist. saveSettings is RBAC-gated + audited, and only writes keys
 * it knows — so a missing/blank field clears that method back to its icon.
 */
export async function savePaymentLogosAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const values: Record<string, string> = {};
  for (const m of CUSTOMER_METHODS) values[paymentLogoKey(m.code)] = str(fd, m.code);
  try {
    await saveSettings(values);
    invalidatePaymentCache();
  } catch (e) { console.error(e); revalidatePath(PATH(locale)); redirect(`${PATH(locale)}?error=1`); }
  revalidatePath(PATH(locale));
  redirect(`${PATH(locale)}?logos=1`);
}

/** Save the uploaded PDF-invoice letterhead image URL (one Setting). */
export async function saveInvoiceLetterheadAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  try { await saveSettings({ 'invoice.letterhead': str(fd, 'invoice.letterhead') }); }
  catch (e) { console.error(e); revalidatePath(PATH(locale)); redirect(`${PATH(locale)}?error=1`); }
  revalidatePath(PATH(locale));
  redirect(`${PATH(locale)}?letterhead=1`);
}
