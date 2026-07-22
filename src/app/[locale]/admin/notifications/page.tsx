import { setRequestLocale } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { listNotifications } from '@/lib/notification-service';
import { loadDefaultTemplatesAction } from '@/server/notification-actions';
import { emailEnabled, pushEnabled } from '@/lib/notification-dispatch';
import { StatusBadge } from '@/components/admin/ui';
import { pick } from '@/lib/admin-i18n';
import { requirePermission } from '@/lib/auth-guards';

export default async function AdminNotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  // Page-level RBAC (matches the sidebar's permission key) — the sidebar only
  // HIDES the link; without this any staffer with one permission could read it.
  await requirePermission('content.manage');
  const { locale } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const [notifs, templateCount, mailOk] = await Promise.all([listNotifications(100), prisma.notificationTemplate.count(), emailEnabled()]);

  return (
    <div className="p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-xl font-semibold">{tb('Notifications', 'الإشعارات')} ({notifs.length})</h1>
        <form action={loadDefaultTemplatesAction}>
          <input type="hidden" name="locale" value={locale} />
          <button className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface">{tb('Load default templates', 'تحميل القوالب الافتراضية')} ({templateCount} {tb('in database', 'في قاعدة البيانات')})</button>
        </form>
      </header>
      <p className="mb-4 text-xs text-muted-foreground">
        {tb('Channels: Email ', 'القنوات: البريد ')}{mailOk ? tb('✓ configured', '✓ مُهيّأ') : tb('— configure SMTP in Providers', '— اضبط SMTP من صفحة المزوّدين')} · {tb('Push ', 'الإشعارات الفورية ')}{pushEnabled() ? tb('✓ configured', '✓ مُهيّأ') : tb('— set VAPID keys', '— اضبط مفاتيح VAPID')}. {tb('Unconfigured channels are logged as ', 'تُسجَّل القنوات غير المُهيّأة على أنها ')}<em>{tb('skipped', 'متخطّاة')}</em>.
      </p>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr><th className="p-3 text-start">{tb('Time', 'الوقت')}</th><th className="p-3 text-start">{tb('Channel', 'القناة')}</th><th className="p-3 text-start">{tb('Template', 'القالب')}</th><th className="p-3 text-start">{tb('To', 'إلى')}</th><th className="p-3 text-start">{tb('Status', 'الحالة')}</th></tr>
          </thead>
          <tbody>
            {notifs.map((n) => (
              <tr key={n.id} className="border-t border-border">
                <td className="p-3 text-muted-foreground">{n.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
                <td className="p-3">{n.channel}</td>
                <td className="p-3 font-medium">{n.templateKey}</td>
                <td className="p-3 text-muted-foreground">{n.toAddress ?? n.customer?.user.email ?? '—'}</td>
                <td className="p-3"><StatusBadge status={n.status} />{n.error ? <span className="ml-2 text-xs text-muted-foreground">{n.error}</span> : null}</td>
              </tr>
            ))}
            {notifs.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">{tb('No notifications yet.', 'لا توجد إشعارات بعد.')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
