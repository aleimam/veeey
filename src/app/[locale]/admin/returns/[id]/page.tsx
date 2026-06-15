import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getReturn } from '@/lib/return-service';
import { processReturnAction } from '@/server/order-actions';
import { StatusBadge, inputCls } from '@/components/admin/ui';

export default async function ReturnDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const ret = await getReturn(id);
  if (!ret) notFound();

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="font-heading text-xl font-semibold">مرتجع · طلب {ret.order.number}</h1>
        <p className="text-sm text-muted-foreground">السبب: {ret.reasonCode} · <StatusBadge status={ret.status} /></p>
      </header>

      <form action={processReturnAction} className="max-w-2xl space-y-5">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={ret.id} />

        <div className="space-y-2">
          <p className="text-sm font-medium">العناصر المرتجعة — حدّد الإجراء (الحجر لمراجعة الصيدلي، لا تُعاد للبيع تلقائيًا أبدًا)</p>
          {ret.items.map((ri) => (
            <div key={ri.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
              <span>{ri.orderItem.product.nameEn} × {ri.qty}</span>
              <span className="flex items-center gap-2">
                <input type="hidden" name="returnItemId" value={ri.id} />
                <select name="disposition" defaultValue={ri.disposition} className={`${inputCls} w-40`}>
                  <option value="PENDING">قيد الانتظار</option>
                  <option value="RESTOCK">إعادة للمخزون → حجر</option>
                  <option value="WRITE_OFF">شطب</option>
                </select>
              </span>
            </div>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-medium">النتيجة
            <select name="status" defaultValue={ret.status} className={inputCls}>
              {['QUARANTINE', 'RESTOCKED', 'WRITTEN_OFF', 'REFUNDED', 'REJECTED'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">طريقة الاسترداد
            <input name="refundMethod" placeholder="تحويل بنكي / رصيد بالمتجر" className={inputCls} />
          </label>
          <label className="block text-sm font-medium">الاسترداد (ج.م)
            <input name="refundEgp" type="number" step="0.01" min="0" className={inputCls} />
          </label>
        </div>

        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">معالجة المرتجع</button>
      </form>
    </div>
  );
}
