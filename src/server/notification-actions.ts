'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-guards';
import { requirePermission } from '@/lib/auth-guards';
import { SEED_TEMPLATES } from '@/lib/notify-templates';

const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');
const bool = (fd: FormData, k: string) => fd.get(k) != null;

export async function saveNotificationPrefsAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const user = await getCurrentUser();
  if (user?.customerId) {
    const data = {
      email: bool(fd, 'email'), push: bool(fd, 'push'), orderUpdates: bool(fd, 'orderUpdates'),
      priceDrop: bool(fd, 'priceDrop'), backInStock: bool(fd, 'backInStock'), marketing: bool(fd, 'marketing'),
    };
    await prisma.notificationPreference.upsert({ where: { customerId: user.customerId }, update: data, create: { customerId: user.customerId, ...data } });
  }
  revalidatePath(`/${locale}/account/notifications`);
  redirect(`/${locale}/account/notifications`);
}

/** Admin: seed the editable default notification templates into the DB. */
export async function loadDefaultTemplatesAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  await requirePermission('content.manage');
  for (const t of SEED_TEMPLATES) {
    await prisma.notificationTemplate.upsert({
      where: { key_channel_locale: { key: t.key, channel: t.channel, locale: t.locale } },
      update: { subject: t.subject ?? null, body: t.body },
      create: { key: t.key, channel: t.channel, locale: t.locale, subject: t.subject ?? null, body: t.body },
    });
  }
  revalidatePath(`/${locale}/admin/notifications`);
  redirect(`/${locale}/admin/notifications`);
}
