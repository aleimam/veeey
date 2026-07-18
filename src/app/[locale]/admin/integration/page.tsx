import { setRequestLocale } from 'next-intl/server';
import { listOutbox } from '@/lib/integration/integration-service';
import { integrationEnabled, integrationSecret, yeldninBaseUrl, INTEGRATION_TOGGLE_KEY } from '@/lib/integration/config';
import { getSetting } from '@/lib/settings-service';
import { setIntegrationEnabledAction } from '@/server/integration-actions';
import { requirePermission } from '@/lib/auth-guards';
import { StatusBadge } from '@/components/admin/ui';
import { pick } from '@/lib/admin-i18n';

export default async function IntegrationPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ toggled?: string }> }) {
  await requirePermission('settings.manage');
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const enabled = await integrationEnabled();
  const secretSet = !!integrationSecret();
  const toggleOn = (await getSetting(INTEGRATION_TOGGLE_KEY)) === 'true';
  const events = await listOutbox(100);

  return (
    <div className="p-6">
      <h1 className="mb-2 font-heading text-xl font-semibold">{tb('YeldnIN integration', 'تكامل YeldnIN')}</h1>
      <p className="text-sm text-muted-foreground">
        {tb('Status:', 'الحالة:')} <span className={enabled ? 'font-medium text-primary' : 'font-medium text-muted-foreground'}>{enabled ? tb('Live', 'يعمل') : tb('Off', 'متوقف')}</span> · {tb('send target', 'وجهة الإرسال')} <code className="text-xs">{yeldninBaseUrl()}</code>
      </p>

      {sp.toggled && <p className="mt-3 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Saved.', 'تم الحفظ.')}</p>}

      {/* Backend on/off switch (Requests epic D). The link is live only when the
          secret is configured (env) AND this toggle is on. */}
      <form action={setIntegrationEnabledAction} className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-border p-4">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="enabled" value={toggleOn ? 'false' : 'true'} />
        <div className="flex-1">
          <p className="text-sm font-medium">{tb('YeldnIN request sync', 'مزامنة طلبات YeldnIN')}</p>
          <p className="text-xs text-muted-foreground">
            {toggleOn
              ? tb('Turned on. Requests sync both ways with YeldnIN.', 'مُفعّل. تتم مزامنة الطلبات في الاتجاهين مع YeldnIN.')
              : tb('Turned off. No requests are sent or received.', 'متوقف. لا يتم إرسال أو استقبال أي طلبات.')}
          </p>
          {!secretSet && <p className="mt-1 text-xs text-destructive">{tb('⚠ Shared secret not configured (env INTEGRATION_CLIENT_VEEEY_SECRET) — the link stays off until it is set.', '⚠ لم يُضبط السر المشترك (INTEGRATION_CLIENT_VEEEY_SECRET) — يبقى الرابط متوقفًا حتى ضبطه.')}</p>}
        </div>
        <button className={`rounded-md px-4 py-2 text-sm font-medium ${toggleOn ? 'border border-border hover:bg-surface' : 'bg-primary text-primary-foreground hover:opacity-90'}`}>
          {toggleOn ? tb('Turn off', 'إيقاف') : tb('Turn on', 'تشغيل')}
        </button>
      </form>

      <h2 className="mb-3 mt-6 text-sm font-semibold">{tb('Outbox', 'صندوق الصادر')} ({events.length})</h2>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr><th className="p-2 text-start">{tb('Time', 'الوقت')}</th><th className="p-2 text-start">{tb('Type', 'النوع')}</th><th className="p-2 text-start">{tb('Entity', 'الكيان')}</th><th className="p-2">{tb('Attempts', 'المحاولات')}</th><th className="p-2">{tb('Status', 'الحالة')}</th><th className="p-2 text-start">{tb('Last error', 'آخر خطأ')}</th></tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="p-2 text-muted-foreground">{e.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
                <td className="p-2 font-medium">{e.type}</td>
                <td className="p-2 text-muted-foreground">{e.aggregateId ?? '—'}</td>
                <td className="p-2 text-center">{e.attempts}</td>
                <td className="p-2"><StatusBadge status={e.status} /></td>
                <td className="p-2 text-xs text-muted-foreground">{e.lastError ?? '—'}</td>
              </tr>
            ))}
            {events.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">{tb('No outbound events ', 'لا توجد أحداث صادرة ')}{enabled ? tb('yet', 'بعد') : tb('(integration disabled)', '(التكامل مُعطّل)')}.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
