import webpush from 'web-push';

/**
 * Channel dispatch (FR-NOT-02). Both channels are env-gated: without credentials
 * a send is reported `skipped` (recorded, ready to send once configured) rather
 * than failing. Email → Resend HTTP API (no SDK dep); Push → web-push + VAPID.
 */
export type DispatchResult = { ok: boolean; skipped?: boolean; error?: string };

export const emailEnabled = () => !!process.env.RESEND_API_KEY;
export const pushEnabled = () => !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let vapidReady = false;
function configureVapid() {
  if (vapidReady || !pushEnabled()) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:info@veeey.com', process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  vapidReady = true;
}

export async function dispatchEmail(to: string, subject: string, body: string): Promise<DispatchResult> {
  if (!emailEnabled()) return { ok: false, skipped: true };
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
