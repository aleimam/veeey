'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { saveSmtpConfig, clearSmtpConfig, saveAiConfig, clearAiConfig, saveSmsConfig, clearSmsConfig, saveWhatsappConfig, clearWhatsappConfig, saveOpayConfig, clearOpayConfig, saveKashierConfig, clearKashierConfig, saveAramexConfig, clearAramexConfig, saveSmsaConfig, clearSmsaConfig } from '@/lib/provider-config-service';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { dispatchEmail, dispatchSms } from '@/lib/notification-dispatch';
import { checkProvider, type CheckableProvider } from '@/lib/provider-check';

const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');
const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' ? v : '';
};

export async function saveSmtpConfigAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  try {
    await saveSmtpConfig({
      'smtp.host': str(fd, 'host'),
      'smtp.port': str(fd, 'port'),
      'smtp.secure': fd.get('secure') != null ? 'true' : '',
      'smtp.user': str(fd, 'user'),
      'smtp.pass': str(fd, 'pass'),
      'smtp.from': str(fd, 'from'),
      'smtp.fromName': str(fd, 'fromName'),
    });
  } catch (e) {
    console.error('smtp save failed', e);
    revalidatePath(`/${locale}/admin/providers`);
    redirect(`/${locale}/admin/providers?error=1`);
  }
  revalidatePath(`/${locale}/admin/providers`);
  redirect(`/${locale}/admin/providers?saved=1`);
}

export async function clearSmtpConfigAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  try { await clearSmtpConfig(); } catch (e) { console.error('smtp clear failed', e); }
  revalidatePath(`/${locale}/admin/providers`);
  redirect(`/${locale}/admin/providers?cleared=1`);
}

export async function saveAiConfigAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  try {
    await saveAiConfig({
      'ai.apiKey': str(fd, 'apiKey'),
      'ai.model': str(fd, 'model'),
      'ai.enabled': fd.get('enabled') != null ? 'true' : 'false',
    });
  } catch (e) {
    console.error('ai save failed', e);
    revalidatePath(`/${locale}/admin/providers`);
    redirect(`/${locale}/admin/providers?error=1`);
  }
  revalidatePath(`/${locale}/admin/providers`);
  redirect(`/${locale}/admin/providers?saved=1`);
}

export async function clearAiConfigAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  try { await clearAiConfig(); } catch (e) { console.error('ai clear failed', e); }
  revalidatePath(`/${locale}/admin/providers`);
  redirect(`/${locale}/admin/providers?cleared=1`);
}

// ---- SMS (SMSMisr) ---------------------------------------------------------
export async function saveSmsConfigAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  try {
    await saveSmsConfig({
      'sms.username': str(fd, 'username'),
      'sms.password': str(fd, 'password'),
      'sms.sender': str(fd, 'sender'),
      'sms.environment': str(fd, 'environment') || '2',
      'sms.language': str(fd, 'language') || '1',
    });
  } catch (e) {
    console.error('sms save failed', e);
    revalidatePath(`/${locale}/admin/providers`);
    redirect(`/${locale}/admin/providers?error=1`);
  }
  revalidatePath(`/${locale}/admin/providers`);
  redirect(`/${locale}/admin/providers?saved=1`);
}

export async function clearSmsConfigAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  try { await clearSmsConfig(); } catch (e) { console.error('sms clear failed', e); }
  revalidatePath(`/${locale}/admin/providers`);
  redirect(`/${locale}/admin/providers?cleared=1`);
}

export async function sendTestSmsAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  await requirePermission('settings.manage');
  const to = str(fd, 'to').trim();
  let result: 'ok' | 'fail' | 'skipped' = 'fail';
  let code = '';
  if (to) {
    // The Arabic variant exercises the Unicode (language 3) path that real
    // Arabic order notifications use; the default stays plain GSM ASCII.
    const message = str(fd, 'variant') === 'ar'
      ? 'رسالة اختبار من Veeey - خدمة الرسائل العربية تعمل بنجاح.'
      : 'Veeey SMS test - your sms.com.eg integration is working.';
    const r = await dispatchSms(to, message);
    result = r.ok ? 'ok' : r.skipped ? 'skipped' : 'fail';
    if (!r.ok && r.error) code = r.error;
  }
  revalidatePath(`/${locale}/admin/providers`);
  redirect(`/${locale}/admin/providers?smstest=${result}${code ? `&smscode=${encodeURIComponent(code)}` : ''}`);
}

// ---- Provider connection checks (OPay / Kashier / Aramex / SMSA) ------------
export async function checkProviderAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const user = await requirePermission('settings.manage');
  const raw = str(fd, 'provider');
  const provider = (['opay', 'kashier', 'aramex', 'smsa'] as const).find((p) => p === raw);
  if (!provider) redirect(`/${locale}/admin/providers`);

  const r = await checkProvider(provider as CheckableProvider);
  await audit({ actorType: 'USER', actorId: user.id, action: 'provider.check', entityType: 'Setting', entityId: provider, data: { status: r.status, code: r.code } });

  const q = new URLSearchParams({ pcheck: provider, pstatus: r.status });
  if (r.code) q.set('pcode', r.code);
  if (r.detail) q.set('pdetail', r.detail.slice(0, 140));
  revalidatePath(`/${locale}/admin/providers`);
  redirect(`/${locale}/admin/providers?${q.toString()}`);
}

// ---- WhatsApp (config-only) ------------------------------------------------
export async function saveWhatsappConfigAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  try {
    await saveWhatsappConfig({ 'wa.sender': str(fd, 'sender'), 'wa.token': str(fd, 'token') });
  } catch (e) {
    console.error('wa save failed', e);
    revalidatePath(`/${locale}/admin/providers`);
    redirect(`/${locale}/admin/providers?error=1`);
  }
  revalidatePath(`/${locale}/admin/providers`);
  redirect(`/${locale}/admin/providers?saved=1`);
}

export async function clearWhatsappConfigAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  try { await clearWhatsappConfig(); } catch (e) { console.error('wa clear failed', e); }
  revalidatePath(`/${locale}/admin/providers`);
  redirect(`/${locale}/admin/providers?cleared=1`);
}

// ---- Payments: OPay --------------------------------------------------------
export async function saveOpayConfigAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  try {
    await saveOpayConfig({
      'opay.merchantId': str(fd, 'merchantId'),
      'opay.publicKey': str(fd, 'publicKey'),
      'opay.privateKey': str(fd, 'privateKey'),
      'opay.environment': str(fd, 'environment') || 'sandbox',
    });
  } catch (e) {
    console.error('opay save failed', e);
    revalidatePath(`/${locale}/admin/providers`);
    redirect(`/${locale}/admin/providers?error=1`);
  }
  revalidatePath(`/${locale}/admin/providers`);
  redirect(`/${locale}/admin/providers?saved=1`);
}

export async function clearOpayConfigAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  try { await clearOpayConfig(); } catch (e) { console.error('opay clear failed', e); }
  revalidatePath(`/${locale}/admin/providers`);
  redirect(`/${locale}/admin/providers?cleared=1`);
}

// ---- Payments: Kashier -----------------------------------------------------
export async function saveKashierConfigAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  try {
    await saveKashierConfig({
      'kashier.merchantId': str(fd, 'merchantId'),
      'kashier.apiKey': str(fd, 'apiKey'),
      'kashier.secretKey': str(fd, 'secretKey'),
      'kashier.environment': str(fd, 'environment') || 'test',
    });
  } catch (e) {
    console.error('kashier save failed', e);
    revalidatePath(`/${locale}/admin/providers`);
    redirect(`/${locale}/admin/providers?error=1`);
  }
  revalidatePath(`/${locale}/admin/providers`);
  redirect(`/${locale}/admin/providers?saved=1`);
}

export async function clearKashierConfigAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  try { await clearKashierConfig(); } catch (e) { console.error('kashier clear failed', e); }
  revalidatePath(`/${locale}/admin/providers`);
  redirect(`/${locale}/admin/providers?cleared=1`);
}

// ---- Shipping carrier: Aramex ----------------------------------------------
export async function saveAramexConfigAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  try {
    await saveAramexConfig({
      'aramex.username': str(fd, 'username'),
      'aramex.password': str(fd, 'password'),
      'aramex.accountNumber': str(fd, 'accountNumber'),
      'aramex.accountPin': str(fd, 'accountPin'),
      'aramex.accountEntity': str(fd, 'accountEntity') || 'CAI',
      'aramex.accountCountryCode': str(fd, 'accountCountryCode') || 'EG',
      'aramex.environment': str(fd, 'environment') || 'test',
    });
  } catch (e) {
    console.error('aramex save failed', e);
    revalidatePath(`/${locale}/admin/providers`);
    redirect(`/${locale}/admin/providers?error=1`);
  }
  revalidatePath(`/${locale}/admin/providers`);
  redirect(`/${locale}/admin/providers?saved=1`);
}
export async function clearAramexConfigAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  try { await clearAramexConfig(); } catch (e) { console.error('aramex clear failed', e); }
  revalidatePath(`/${locale}/admin/providers`);
  redirect(`/${locale}/admin/providers?cleared=1`);
}

// ---- Shipping carrier: SMSA ------------------------------------------------
export async function saveSmsaConfigAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  try {
    await saveSmsaConfig({
      'smsa.apiKey': str(fd, 'apiKey'),
      'smsa.passKey': str(fd, 'passKey'),
      'smsa.environment': str(fd, 'environment') || 'test',
    });
  } catch (e) {
    console.error('smsa save failed', e);
    revalidatePath(`/${locale}/admin/providers`);
    redirect(`/${locale}/admin/providers?error=1`);
  }
  revalidatePath(`/${locale}/admin/providers`);
  redirect(`/${locale}/admin/providers?saved=1`);
}
export async function clearSmsaConfigAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  try { await clearSmsaConfig(); } catch (e) { console.error('smsa clear failed', e); }
  revalidatePath(`/${locale}/admin/providers`);
  redirect(`/${locale}/admin/providers?cleared=1`);
}

export async function sendTestEmailAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  await requirePermission('settings.manage');
  const to = str(fd, 'to').trim();
  let result: 'ok' | 'fail' | 'skipped' = 'fail';
  if (to) {
    const r = await dispatchEmail(to, 'Veeey SMTP test', 'This is a test email from your Veeey admin — SMTP is working.');
    result = r.ok ? 'ok' : r.skipped ? 'skipped' : 'fail';
  }
  revalidatePath(`/${locale}/admin/providers`);
  redirect(`/${locale}/admin/providers?test=${result}`);
}
