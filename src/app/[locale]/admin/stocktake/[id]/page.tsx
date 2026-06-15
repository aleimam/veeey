import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getStocktake, forwardList } from '@/lib/stocktake-service';
import { recordCountAction, closeStocktakeAction } from '@/server/inventory-actions';
import { StatusBadge, inputCls } from '@/components/admin/ui';

const monthYear = (d: Date) => `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;

export default async function StocktakeDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await getStocktake(id);
  if (!session) notFound();
  const rows = await forwardList(id);
  const open = session.status === 'OPEN';

  return (
    <div className="p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold">{session.name}</h1>
          <p className="text-sm text-muted-foreground">{session.location.name} · <StatusBadge status={session.status} /></p>
        </div>
        {open && (
          <form action={closeStocktakeAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="sessionId" value={session.id} />
            <button className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface">إغلاق الجلسة</button>
          </form>
        )}
      </header>

      <h2 className="mb-3 text-sm font-semibold">المرحلة 1 — العدّ التقدمي ({rows.length} دفعة في المخزون)</h2>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3 text-start">المنتج</th>
              <th className="p-3 text-start">الصلاحية</th>
              <th className="p-3 text-start">المتوقع</th>
              <th className="p-3 text-start">المعدود</th>
              <th className="p-3 text-start">الفرق</th>
              {open && <th className="p-3 text-start">تسجيل العدّ</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ lot, expected, counted }) => (
              <tr key={lot.id} className="border-t border-border">
                <td className="p-3 font-medium">{lot.product.nameEn} <span className="text-muted-foreground">({lot.product.sku})</span></td>
                <td className="p-3">{lot.expiryDate ? monthYear(lot.expiryDate) : 'بدون صلاحية'}</td>
                <td className="p-3">{expected}</td>
                <td className="p-3">{counted ?? '—'}</td>
                <td className="p-3">{counted != null ? <span className={counted - expected !== 0 ? 'text-destructive' : 'text-primary'}>{counted - expected > 0 ? '+' : ''}{counted - expected}</span> : '—'}</td>
                {open && (
                  <td className="p-3">
                    <form action={recordCountAction} className="flex items-center gap-2">
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="sessionId" value={session.id} />
                      <input type="hidden" name="lotId" value={lot.id} />
                      <input type="number" name="countedQty" min="0" defaultValue={counted ?? expected} className={`${inputCls} w-20`} />
                      <input name="reason" placeholder="السبب" className={`${inputCls} w-28`} />
                      <button className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground">حفظ</button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={open ? 6 : 5} className="p-6 text-center text-muted-foreground">لا توجد دفعات في المخزون بهذا الموقع.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">المتوقع = المخزون المتاح + الحجوزات النشطة. تُسجَّل عمليات العدّ في المخزون المتاح فورًا وتُكتب في سجل الحركات. الدفعات غير المعدودة تُعلَّم ولا تُصفَّر أبدًا.</p>
    </div>
  );
}
