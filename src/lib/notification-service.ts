import { prisma } from '@/lib/prisma';
import { renderTemplate, SEED_TEMPLATES } from '@/lib/notify-templates';
import { channelAllowed, DEFAULT_PREFS, type NotifyType, type NotifyChannel, type Prefs } from '@/lib/notify-prefs';
import { dispatchEmail, dispatchPush } from '@/lib/notification-dispatch';

/** Notification pipeline (FR-NOT-*): preference gate → template render → record →
 *  channel dispatch (env-gated). Always records a Notification row with outcome. */

export async function getPrefs(customerId: string): Promise<Prefs> {
  const p = await prisma.notificationPreference.findUnique({ where: { customerId } });
  return p ? { email: p.email, push: p.push, orderUpdates: p.orderUpdates, priceDrop: p.priceDrop, backInStock: p.backInStock, marketing: p.marketing } : DEFAULT_PREFS;
}

async function resolveTemplate(key: string, channel: NotifyChannel, locale: string) {
  const db = await prisma.notificationTemplate.findUnique({ where: { key_channel_locale: { key, channel, locale } } }).catch(() => null);
  if (db) return { subject: db.subject ?? undefined, body: db.body };
  const seed = SEED_TEMPLATES.find((t) => t.key === key && t.channel === channel && t.locale === locale) ?? SEED_TEMPLATES.find((t) => t.key === key && t.channel === channel);
  return seed ? { subject: seed.subject, body: seed.body } : null;
}

export type NotifyInput = {
  customerId?: string | null;
  toAddress?: string | null;
  type: NotifyType;
  channel: NotifyChannel;
  templateKey: string;
  vars: Record<string, string | number>;
  refType?: string;
  refId?: string;
  locale?: string;
};

export async function notify(input: NotifyInput) {
  const locale = input.locale ?? 'en';

  if (input.customerId) {
    const prefs = await getPrefs(input.customerId);
    if (!channelAllowed(prefs, input.type, input.channel)) {
      return prisma.notification.create({ data: { customerId: input.customerId, channel: input.channel, templateKey: input.templateKey, body: '(opted out)', status: 'SKIPPED', error: 'opted_out', refType: input.refType, refId: input.refId } });
    }
  }

  const tpl = await resolveTemplate(input.templateKey, input.channel, locale);
  if (!tpl) {
    return prisma.notification.create({ data: { customerId: input.customerId ?? null, channel: input.channel, templateKey: input.templateKey, body: '(no template)', status: 'FAILED', error: 'no_template', refType: input.refType, refId: input.refId } });
  }

  const subject = tpl.subject ? renderTemplate(tpl.subject, input.vars) : null;
  const body = renderTemplate(tpl.body, input.vars);
  const notif = await prisma.notification.create({ data: { customerId: input.customerId ?? null, channel: input.channel, templateKey: input.templateKey, toAddress: input.toAddress ?? null, subject, body, status: 'PENDING', refType: input.refType, refId: input.refId } });

  let result: { ok: boolean; skipped?: boolean; error?: string };
  if (input.channel === 'EMAIL') {
    result = input.toAddress ? await dispatchEmail(input.toAddress, subject ?? 'Veeey', body) : { ok: false, error: 'no_address' };
  } else {
    const subs = input.customerId ? await prisma.pushSubscription.findMany({ where: { customerId: input.customerId } }) : [];
    if (subs.length === 0) result = { ok: false, skipped: true, error: 'no_subscription' };
    else {
      const r = await Promise.all(subs.map((s) => dispatchPush(s, { title: subject ?? 'Veeey', body })));
      result = { ok: r.some((x) => x.ok), skipped: r.every((x) => x.skipped), error: r.find((x) => x.error)?.error };
    }
  }

  const status = result.ok ? 'SENT' : result.skipped ? 'SKIPPED' : 'FAILED';
  return prisma.notification.update({ where: { id: notif.id }, data: { status, error: result.ok ? null : result.error ?? 'skipped', sentAt: result.ok ? new Date() : null } });
}

export const listNotifications = (limit = 100) => prisma.notification.findMany({ orderBy: { createdAt: 'desc' }, take: limit, include: { customer: { include: { user: { select: { email: true } } } } } });
