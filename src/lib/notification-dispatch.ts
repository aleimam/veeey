import webpush from 'web-push';
import { getSmtpConfig, getSmsConfig, getWhatsappConfig, normalizeMobile } from '@/lib/provider-config';

/**
 * Channel dispatch (FR-NOT-02). Without credentials a send is reported `skipped`
 * (recorded, ready once configured) rather than failing. Email → admin-configured
 * SMTP (nodemailer) if set, else Resend HTTP API (env); Push → web-push + VAPID.
 */
export type DispatchResult = { ok: boolean; skipped?: boolean; error?: string };

// Sync env check (for the admin status line); the real send also resolves DB-stored SMTP.
export const emailEnabled = () => !!(process.env.RESEND_API_KEY || process.env.SMTP_HOST);
export const pushEnabled = () => !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let vapidReady = false;
function configureVapid() {
  if (vapidReady || !pushEnabled()) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:info@veeey.com', process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  vapidReady = true;
}

export async function dispatchEmail(to: string, subject: string, body: string): Promise<DispatchResult> {
  // 1) Admin-configured SMTP (DB or env) via nodemailer.
  const smtp = await getSmtpConfig();
  if (smtp) {
    try {
      const { createTransport } = await import('nodemailer');
      const transport = createTransport({ host: smtp.host, port: smtp.port, secure: smtp.secure, auth: { user: smtp.user, pass: smtp.pass } });
      await transport.sendMail({ from: `${smtp.fromName} <${smtp.from}>`, to, subject, text: body });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message.slice(0, 120) : 'smtp_error' };
    }
  }
  // 2) Resend HTTP API (env fallback).
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: process.env.EMAIL_FROM ?? 'Veeey <info@veeey.com>', to, subject, text: body }),
      });
      return res.ok ? { ok: true } : { ok: false, error: `email_http_${res.status}` };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message.slice(0, 120) : 'email_error' };
    }
  }
  return { ok: false, skipped: true };
}

/** True when the text needs SMSMisr's Unicode encoding (language 3): anything
 *  outside printable ASCII (Arabic, em dashes, curly quotes) is rejected with
 *  code 1909 under language 1/2. */
const needsUnicodeSms = (text: string) => [...text].some((ch) => {
  const c = ch.codePointAt(0)!;
  return (c < 0x20 && ch !== '\n' && ch !== '\r') || c > 0x7e;
});

/** SMS via SMSMisr (sms.com.eg). Mobile may be comma-separated; each is
 *  normalized to the 2011… form. Success response code is 1901. */
export async function dispatchSms(to: string, message: string): Promise<DispatchResult> {
  const cfg = await getSmsConfig();
  if (!cfg) return { ok: false, skipped: true };
  const mobile = to.split(',').map((m) => normalizeMobile(m)).filter(Boolean).join(',');
  if (!mobile) return { ok: false, error: 'no_mobile' };
  try {
    const body = new URLSearchParams({
      environment: cfg.environment,
      username: cfg.username,
      password: cfg.password,
      sender: cfg.sender,
      mobile,
      language: needsUnicodeSms(message) ? '3' : cfg.language,
      message,
    });
    const res = await fetch('https://smsmisr.com/api/SMS/', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    const json = (await res.json().catch(() => null)) as { code?: string | number } | null;
    if (json && String(json.code) === '1901') return { ok: true };
    return { ok: false, error: `sms_${json?.code ?? res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 120) : 'sms_error' };
  }
}

/** WhatsApp via the Meta Cloud API — free-form text message (allowed inside the
 *  24h customer-service window; order confirmations follow the customer's own
 *  checkout, so they qualify). Skipped when the provider isn't configured. */
export async function dispatchWhatsapp(to: string, message: string): Promise<DispatchResult> {
  const cfg = await getWhatsappConfig();
  if (!cfg) return { ok: false, skipped: true };
  const mobile = normalizeMobile(to.split(',')[0] ?? '');
  if (!mobile) return { ok: false, error: 'no_mobile' };
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${encodeURIComponent(cfg.sender)}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${cfg.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: mobile, type: 'text', text: { body: message } }),
    });
    if (res.ok) return { ok: true };
    const err = (await res.json().catch(() => null)) as { error?: { code?: number } } | null;
    return { ok: false, error: `wa_${err?.error?.code ?? res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 120) : 'wa_error' };
  }
}

export async function dispatchPush(sub: { endpoint: string; p256dh: string; auth: string }, payload: object): Promise<DispatchResult> {
  if (!pushEnabled()) return { ok: false, skipped: true };
  configureVapid();
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 120) : 'push_error' };
  }
}
