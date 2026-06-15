import webpush from 'web-push';
import { getSmtpConfig } from '@/lib/provider-config';

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
