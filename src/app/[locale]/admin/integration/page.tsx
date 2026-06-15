import { setRequestLocale } from 'next-intl/server';
import { listOutbox } from '@/lib/integration/integration-service';
import { integrationEnabled, yeldninBaseUrl } from '@/lib/integration/config';
import { StatusBadge } from '@/components/admin/ui';

export default async function IntegrationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const enabled = integrationEnabled();
  const events = await listOutbox(100);

  return (
    <div className="p-6">
      <h1 className="mb-2 font-heading text-xl font-semibold">تكامل YeldnIN</h1>
      <p className="text-sm text-muted-foreground">
        الحالة: <span className={enabled ? 'font-medium text-primary' : 'font-medium text-muted-foreground'}>{enabled ? 'مُفعّل' : 'مُعطّل (افتراضي)'}</span> · وجهة الإرسال <code className="text-xs">{yeldninBaseUrl()}</code>
      </p>
      <div className="mt-3 rounded-lg border border-amber-300/50 bg-amber-50/40 p-3 text-xs text-muted-foreground">
        ⚠️ يُشحن مُعطّلًا. قبل التفعيل في بيئة الاختبار: أعد ضبط <code>INTEGRATION_CONTRACT.md</code> وفق أحدث وصف لـ YeldnIN، واضبط <code>INTEGRATION_ENABLED=1</code> + <code>INTEGRATION_CLIENT_VEEEY_SECRET</code>، وطوّر مقابل <code>npm run mock:yeldnin</code>.
      </div>

      <h2 className="mb-3 mt-6 text-sm font-semibold">صندوق الصادر ({events.length})</h2>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr><th className="p-2 text-start">الوقت</th><th className="p-2 text-start">النوع</th><th className="p-2 text-start">الكيان</th><th className="p-2">المحاولات</th><th className="p-2">الحالة</th><th className="p-2 text-start">آخر خطأ</th></tr>
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
            {events.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">لا توجد أحداث صادرة {enabled ? 'بعد' : '(التكامل مُعطّل)'}.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
