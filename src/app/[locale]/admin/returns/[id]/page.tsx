import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getReturn } from '@/lib/return-service';
import { processReturnAction } from '@/server/order-actions';
import { StatusBadge, inputCls } from '@/components/admin/ui';
import { pick } from '@/lib/admin-i18n';
import { requirePermission } from '@/lib/auth-guards';

export default async function ReturnDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  // Page-level RBAC (matches the sidebar's permission key) — the sidebar only
  // HIDES the link; without this any staffer with one permission could read it.
  await requirePermission('returns.manage');
  const { locale, id } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const ret = await getReturn(id);
  if (!ret) notFound();

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="font-heading text-xl font-semibold">{tb('Return', 'مرتجع')} · {tb('Order', 'طلب')} {ret.order.number}</h1>
        <p className="text-sm text-muted-foreground">{tb('Reason', 'السبب')}: {ret.reasonCode} · <StatusBadge status={ret.status} /></p>
      </header>

      <form action={processReturnAction} className="max-w-2xl space-y-5">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={ret.id} />

        <div className="space-y-2">
          <p className="text-sm font-medium">{tb('Returned items — choose action (quarantine for pharmacist review, never auto-restocked)', 'العناصر المرتجعة — حدّد الإجراء (الحجر لمراجعة الصيدلي، لا تُعاد للبيع تلقائيًا أبدًا)')}</p>
          {ret.items.map((ri) => (
            <div key={ri.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
              <span>{ri.orderItem.product.nameEn} × {ri.qty}</span>
              <span className="flex items-center gap-2">
                <input type="hidden" name="returnItemId" value={ri.id} />
                <select name="disposition" defaultValue={ri.disposition} className={`${inputCls} w-40`}>
                  <option value="PENDING">{tb('Pending', 'قيد الانتظار')}</option>
                  <option value="RESTOCK">{tb('Restock → quarantine', 'إعادة للمخزون → حجر')}</option>
                  <option value="WRITE_OFF">{tb('Write off', 'شطب')}</option>
                </select>
              </span>
            </div>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-medium">{tb('Outcome', 'النتيجة')}
            <select name="status" defaultValue={ret.status} className={inputCls}>
              {['QUARANTINE', 'RESTOCKED', 'WRITTEN_OFF', 'REFUNDED', 'REJECTED'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">{tb('Refund method', 'طريقة الاسترداد')}
            <input name="refundMethod" placeholder={tb('Bank transfer / store credit', 'تحويل بنكي / رصيد بالمتجر')} className={inputCls} />
          </label>
          <label className="block text-sm font-medium">{tb('Refund (EGP)', 'الاسترداد (ج.م)')}
            <input name="refundEgp" type="number" step="0.01" min="0" className={inputCls} />
          </label>
        </div>

        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{tb('Process return', 'معالجة المرتجع')}</button>
      </form>
    </div>
  );
}
