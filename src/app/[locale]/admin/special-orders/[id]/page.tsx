import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getSpecialOrder, SPECIAL_ORDER_STATUSES } from '@/lib/special-order-service';
import { advanceSpecialOrderAction, setSpecialOrderDetailsAction } from '@/server/special-order-actions';
import { inputCls, StatusBadge } from '@/components/admin/ui';
import { piastresToEgp } from '@/lib/format';
import { pick } from '@/lib/admin-i18n';

export default async function SpecialOrderDetail({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const so = await getSpecialOrder(id);
  if (!so) notFound();

  return (
    <div className="p-6">
      <Link href="/admin/special-orders" className="text-sm text-primary hover:underline">← {tb('Special orders', 'الطلبات الخاصة')}</Link>
      <div className="mt-2 mb-6 flex items-center gap-3">
        <h1 className="font-heading text-xl font-semibold">{tb('Special order', 'طلب خاص')}</h1>
        <StatusBadge status={so.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border p-4 text-sm">
          <h2 className="mb-3 font-heading text-lg font-semibold">{tb('Request', 'الطلب')}</h2>
          <dl className="space-y-1.5">
            <div><dt className="inline text-muted-foreground">{tb('Product', 'المنتج')}: </dt><dd className="inline font-medium">{so.requestedProductText ?? '—'}</dd></div>
            {so.productUrl && <div><dt className="inline text-muted-foreground">{tb('Link', 'الرابط')}: </dt><dd className="inline"><a href={so.productUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline break-all">{so.productUrl}</a></dd></div>}
            <div><dt className="inline text-muted-foreground">{tb('Requester', 'مقدّم الطلب')}: </dt><dd className="inline">{so.requesterName ?? so.customer?.user.email ?? '—'}</dd></div>
            <div><dt className="inline text-muted-foreground">{tb('Phone', 'الهاتف')}: </dt><dd className="inline">{so.requesterPhone ?? '—'}</dd></div>
            <div><dt className="inline text-muted-foreground">{tb('Email', 'البريد الإلكتروني')}: </dt><dd className="inline">{so.requesterEmail ?? so.customer?.user.email ?? '—'}</dd></div>
            {so.notes && <div><dt className="inline text-muted-foreground">{tb('Notes', 'ملاحظات')}: </dt><dd className="inline">{so.notes}</dd></div>}
            <div><dt className="inline text-muted-foreground">{tb('Linked order', 'الطلب المرتبط')}: </dt><dd className="inline">{so.order?.number ?? '—'}</dd></div>
            {so.compensationPiastres != null && <div><dt className="inline text-muted-foreground">{tb('Compensation', 'التعويض')}: </dt><dd className="inline">{piastresToEgp(so.compensationPiastres)} {tb('EGP', 'ج.م')}</dd></div>}
          </dl>

          <form action={advanceSpecialOrderAction} className="mt-4 flex items-end gap-2">
            <input type="hidden" name="id" value={so.id} />
            <input type="hidden" name="locale" value={locale} />
            <label className="text-sm font-medium">{tb('Status', 'الحالة')}
              <select name="status" defaultValue={so.status} className={`${inputCls} w-48`}>
                {SPECIAL_ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{tb('Update status', 'تحديث الحالة')}</button>
          </form>
        </section>

        <section className="rounded-lg border border-border p-4">
          <h2 className="mb-3 font-heading text-lg font-semibold">{tb('Supply details', 'تفاصيل التوريد')}</h2>
          <form action={setSpecialOrderDetailsAction} className="space-y-3 text-sm">
            <input type="hidden" name="id" value={so.id} />
            <input type="hidden" name="locale" value={locale} />
            <label className="block font-medium">{tb('SLA type', 'نوع اتفاقية مستوى الخدمة')}<input name="slaType" defaultValue={so.slaType ?? ''} placeholder={tb('Fast 20 days / From manufacturer 30 days / Injections 40 days', 'سريع 20 يومًا / من المُصنّع 30 يومًا / حقن 40 يومًا')} className={inputCls} /></label>
            <label className="block font-medium">{tb('Deadline', 'الموعد النهائي')}<input name="deadlineAt" type="date" defaultValue={so.deadlineAt ? so.deadlineAt.toISOString().slice(0, 10) : ''} className={inputCls} /></label>
            <label className="block font-medium">{tb('Product (refine)', 'المنتج (تنقيح)')}<input name="requestedProductText" defaultValue={so.requestedProductText ?? ''} className={inputCls} /></label>
            <label className="block font-medium">{tb('Notes', 'ملاحظات')}<textarea name="notes" rows={2} defaultValue={so.notes ?? ''} className={inputCls} /></label>
            <label className="block font-medium">{tb('Compensation (EGP)', 'التعويض (ج.م)')}<input name="compensationEgp" type="number" step="0.01" min={0} defaultValue={so.compensationPiastres != null ? piastresToEgp(so.compensationPiastres) : ''} className={inputCls} /></label>
            <button className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface">{tb('Save details', 'حفظ التفاصيل')}</button>
          </form>
        </section>
      </div>
    </div>
  );
}
