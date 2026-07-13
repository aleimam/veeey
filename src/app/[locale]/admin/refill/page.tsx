import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requirePermission } from '@/lib/auth-guards';
import { pick } from '@/lib/admin-i18n';
import { listRefillPlans } from '@/lib/refill-service';
import { adminRefillStatusAction } from '@/server/refill-actions';

export const dynamic = 'force-dynamic';
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
type SP = Record<string, string | string[] | undefined>;

const STATUSES = ['ACTIVE', 'PAUSED', 'CANCELLED'] as const;

export default async function AdminRefillPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  await requirePermission('orders.read');
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);

  const status = STATUSES.find((s) => s === one(sp.status));
  const plans = await listRefillPlans(status);
  const flag = one(sp.saved) ? 'saved' : one(sp.error);
  const th = 'px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground';
  const td = 'px-3 py-2 text-sm align-middle';
  const dateFmt = (d: Date) => d.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' });

  return (
    <div className="max-w-5xl p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-foreground">{tb('Refill plans', 'خطط ريفيل')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {tb('COD autoship subscriptions. The worker places due orders daily at 07:00 UTC after an SMS advance notice; out-of-stock cycles are skipped.', 'اشتراكات إعادة التعبئة بالدفع عند الاستلام. ينشئ العامل الطلبات المستحقة يوميًا 07:00 UTC بعد إشعار SMS مسبق؛ وتُتخطى دورات نفاد المخزون.')}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          <Link href="/admin/refill" className={`rounded-md px-3 py-1 text-sm ${!status ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-surface'}`}>{tb('All', 'الكل')}</Link>
          {STATUSES.map((s) => (
            <Link key={s} href={`/admin/refill?status=${s}`} className={`rounded-md px-3 py-1 text-sm ${status === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-surface'}`}>{s}</Link>
          ))}
        </div>
      </div>

      {flag === 'saved' && <div className="mb-4 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Plan updated.', 'تم تحديث الخطة.')}</div>}
      {flag === 'forbidden' && <div className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb("You don't have permission.", 'ليس لديك صلاحية.')}</div>}
      {flag === '1' && <div className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Could not update.', 'تعذّر التحديث.')}</div>}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[760px] border-collapse">
          <thead className="bg-surface">
            <tr>
              <th className={th}>{tb('Customer', 'العميل')}</th>
              <th className={th}>{tb('Product', 'المنتج')}</th>
              <th className={`${th} text-end`}>{tb('Qty', 'كمية')}</th>
              <th className={`${th} text-end`}>{tb('Every', 'كل')}</th>
              <th className={th}>{tb('Status', 'الحالة')}</th>
              <th className={th}>{tb('Next run', 'التشغيل القادم')}</th>
              <th className={th}>{tb('Last outcome', 'آخر نتيجة')}</th>
              <th className={`${th} text-end`}></th>
            </tr>
          </thead>
          <tbody>
            {plans.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-sm text-muted-foreground">{tb('No Refill plans yet.', 'لا خطط ريفيل بعد.')}</td></tr>}
            {plans.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className={td}>
                  <Link href={`/admin/customers/${p.customerId}`} className="text-primary hover:underline">{p.customerName}</Link>
                  {p.phone && <div className="text-[11px] text-muted-foreground">{p.phone}</div>}
                </td>
                <td className={`${td} font-medium text-foreground`}>{p.productName}</td>
                <td className={`${td} text-end tabular-nums`}>{p.qty}</td>
                <td className={`${td} text-end tabular-nums`}>{tb(`${p.frequencyDays}d`, `${p.frequencyDays} يوم`)}</td>
                <td className={td}>
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${p.status === 'ACTIVE' ? 'bg-primary/10 text-primary' : p.status === 'PAUSED' ? 'bg-surface text-muted-foreground' : 'bg-destructive/10 text-destructive'}`}>{p.status}</span>
                  {p.skipNext && <span className="ms-1 text-[10px] text-muted-foreground">{tb('skip next', 'تخطٍّ قادم')}</span>}
                </td>
                <td className={td}>{p.status === 'ACTIVE' ? dateFmt(p.nextRunAt) : '—'}</td>
                <td className={`${td} text-muted-foreground`}>{p.lastOutcome ?? '—'}</td>
                <td className={`${td} text-end`}>
                  {p.status !== 'CANCELLED' && (
                    <div className="flex justify-end gap-1.5">
                      <form action={adminRefillStatusAction}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="planId" value={p.id} />
                        <input type="hidden" name="status" value={p.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED'} />
                        <button className="h-8 rounded-md border border-border px-2.5 text-xs font-medium hover:bg-surface">{p.status === 'PAUSED' ? tb('Resume', 'استئناف') : tb('Pause', 'إيقاف')}</button>
                      </form>
                      <form action={adminRefillStatusAction}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="planId" value={p.id} />
                        <input type="hidden" name="status" value="CANCELLED" />
                        <button className="h-8 rounded-md border border-border px-2.5 text-xs font-medium text-destructive hover:bg-destructive/10">{tb('Cancel', 'إلغاء')}</button>
                      </form>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
