'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { saveSmtpConfig, clearSmtpConfig, saveAiConfig, clearAiConfig, saveSmsConfig, clearSmsConfig, saveWhatsappConfig, clearWhatsappConfig } from '@/lib/provider-config-service';
import { requirePermission } from '@/lib/auth-guards';
import { dispatchEmail, dispatchSms } from '@/lib/notification-dispatch';

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
  if (to) {
    const r = await dispatchSms(to, 'Veeey SMS test — your sms.com.eg integration is working.');
    result = r.ok ? 'ok' : r.skipped ? 'skipped' : 'fail';
  }
  revalidatePath(`/${locale}/admin/providers`);
  redirect(`/${locale}/admin/providers?smstest=${result}`);
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
