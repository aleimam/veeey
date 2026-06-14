import { setRequestLocale } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { listNotifications } from '@/lib/notification-service';
import { loadDefaultTemplatesAction } from '@/server/notification-actions';
import { emailEnabled, pushEnabled } from '@/lib/notification-dispatch';
import { StatusBadge } from '@/components/admin/ui';

export default async function AdminNotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [notifs, templateCount] = await Promise.all([listNotifications(100), prisma.notificationTemplate.count()]);

  return (
    <div className="p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-xl font-semibold">Notifications ({notifs.length})</h1>
        <form action={loadDefaultTemplatesAction}>
          <input type="hidden" name="locale" value={locale} />
          <button className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface">Load default templates ({templateCount} in DB)</button>
        </form>
      </header>
      <p className="mb-4 text-xs text-muted-foreground">
        Channels: Email {emailEnabled() ? '✓ configured' : '— set RESEND_API_KEY'} · Push {pushEnabled() ? '✓ configured' : '— set VAPID keys'}. Un-configured channels record as <em>SKIPPED</em>.
      </p>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr><th className="p-3 text-start">When</th><th className="p-3 text-start">Channel</th><th className="p-3 text-start">Template</th><th className="p-3 text-start">To</th><th className="p-3 text-start">Status</th></tr>
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
            {notifs.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No notifications yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
