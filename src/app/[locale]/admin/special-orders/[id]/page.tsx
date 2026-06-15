import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getSpecialOrder, SPECIAL_ORDER_STATUSES } from '@/lib/special-order-service';
import { advanceSpecialOrderAction, setSpecialOrderDetailsAction } from '@/server/special-order-actions';
import { inputCls, StatusBadge } from '@/components/admin/ui';
import { piastresToEgp } from '@/lib/format';

export default async function SpecialOrderDetail({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const so = await getSpecialOrder(id);
  if (!so) notFound();

  return (
    <div className="p-6">
      <Link href="/admin/special-orders" className="text-sm text-primary hover:underline">← الطلبات الخاصة</Link>
      <div className="mt-2 mb-6 flex items-center gap-3">
        <h1 className="font-heading text-xl font-semibold">طلب خاص</h1>
        <StatusBadge status={so.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border p-4 text-sm">
          <h2 className="mb-3 font-heading text-lg font-semibold">الطلب</h2>
          <dl className="space-y-1.5">
            <div><dt className="inline text-muted-foreground">المنتج: </dt><dd className="inline font-medium">{so.requestedProductText ?? '—'}</dd></div>
            {so.productUrl && <div><dt className="inline text-muted-foreground">الرابط: </dt><dd className="inline"><a href={so.productUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline break-all">{so.productUrl}</a></dd></div>}
            <div><dt className="inline text-muted-foreground">مقدّم الطلب: </dt><dd className="inline">{so.requesterName ?? so.customer?.user.email ?? '—'}</dd></div>
            <div><dt className="inline text-muted-foreground">الهاتف: </dt><dd className="inline">{so.requesterPhone ?? '—'}</dd></div>
            <div><dt className="inline text-muted-foreground">البريد الإلكتروني: </dt><dd className="inline">{so.requesterEmail ?? so.customer?.user.email ?? '—'}</dd></div>
            {so.notes && <div><dt className="inline text-muted-foreground">ملاحظات: </dt><dd className="inline">{so.notes}</dd></div>}
            <div><dt className="inline text-muted-foreground">الطلب المرتبط: </dt><dd className="inline">{so.order?.number ?? '—'}</dd></div>
            {so.compensationPiastres != null && <div><dt className="inline text-muted-foreground">التعويض: </dt><dd className="inline">{piastresToEgp(so.compensationPiastres)} ج.م</dd></div>}
          </dl>

          <form action={advanceSpecialOrderAction} className="mt-4 flex items-end gap-2">
            <input type="hidden" name="id" value={so.id} />
            <input type="hidden" name="locale" value={locale} />
            <label className="text-sm font-medium">الحالة
              <select name="status" defaultValue={so.status} className={`${inputCls} w-48`}>
                {SPECIAL_ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">تحديث الحالة</button>
          </form>
        </section>

        <section className="rounded-lg border border-border p-4">
          <h2 className="mb-3 font-heading text-lg font-semibold">تفاصيل التوريد</h2>
          <form action={setSpecialOrderDetailsAction} className="space-y-3 text-sm">
            <input type="hidden" name="id" value={so.id} />
            <input type="hidden" name="locale" value={locale} />
            <label className="block font-medium">نوع اتفاقية مستوى الخدمة<input name="slaType" defaultValue={so.slaType ?? ''} placeholder="سريع 20 يومًا / من المُصنّع 30 يومًا / حقن 40 يومًا" className={inputCls} /></label>
            <label className="block font-medium">الموعد النهائي<input name="deadlineAt" type="date" defaultValue={so.deadlineAt ? so.deadlineAt.toISOString().slice(0, 10) : ''} className={inputCls} /></label>
            <label className="block font-medium">المنتج (تنقيح)<input name="requestedProductText" defaultValue={so.requestedProductText ?? ''} className={inputCls} /></label>
            <label className="block font-medium">ملاحظات<textarea name="notes" rows={2} defaultValue={so.notes ?? ''} className={inputCls} /></label>
            <label className="block font-medium">التعويض (ج.م)<input name="compensationEgp" type="number" step="0.01" min={0} defaultValue={so.compensationPiastres != null ? piastresToEgp(so.compensationPiastres) : ''} className={inputCls} /></label>
            <button className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface">حفظ التفاصيل</button>
          </form>
        </section>
      </div>
    </div>
  );
}
