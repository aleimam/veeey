import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getRequest } from '@/lib/request-service';
import { approveRequestAction, rejectRequestAction, archiveRequestAction } from '@/server/request-actions';
import { requestTypeLabel } from '@/lib/request-i18n';
import { requestEditable } from '@/lib/request-logic';
import { StatusBadge, inputCls } from '@/components/admin/ui';
import { piastresToEgp } from '@/lib/format';
import { pick } from '@/lib/admin-i18n';
import { requirePermission } from '@/lib/auth-guards';

export default async function RequestDetail({ params }: { params: Promise<{ locale: string; id: string }> }) {
  await requirePermission('requests.manage');
  const { locale, id } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const r = await getRequest(id);
  if (!r) notFound();

  const editable = requestEditable(r.status);
  const customerName = r.customer ? `${r.customer.firstName ?? ''} ${r.customer.lastName ?? ''}`.trim() : null;

  return (
    <div className="p-6">
      <Link href="/admin/requests" className="text-sm text-primary hover:underline">← {tb('Requests', 'الطلبات')}</Link>
      <div className="mt-2 mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-xl font-semibold font-mono">{r.uid ?? r.id.slice(0, 8)}</h1>
        <span className="text-sm text-muted-foreground">{requestTypeLabel(tb, r.type)}</span>
        <StatusBadge status={r.status} />
        {editable && <Link href={`/admin/requests/${r.id}/edit`} className="ms-auto rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface">{tb('Edit', 'تعديل')}</Link>}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border p-4 text-sm">
          <h2 className="mb-3 font-heading text-lg font-semibold">{tb('Details', 'التفاصيل')}</h2>
          <dl className="space-y-1.5">
            <div><dt className="inline text-muted-foreground">{tb('Type', 'النوع')}: </dt><dd className="inline">{requestTypeLabel(tb, r.type)}</dd></div>
            {customerName && <div><dt className="inline text-muted-foreground">{tb('Customer', 'العميل')}: </dt><dd className="inline font-medium">{customerName}</dd></div>}
            {r.order && <div><dt className="inline text-muted-foreground">{tb('Linked order', 'الطلب المرتبط')}: </dt><dd className="inline"><Link href={`/admin/orders/${r.order.id}`} className="text-primary hover:underline">{r.order.number}</Link></dd></div>}
            <div><dt className="inline text-muted-foreground">{tb('Requested by', 'بواسطة')}: </dt><dd className="inline">{r.requestedByName ?? '—'}</dd></div>
            <div><dt className="inline text-muted-foreground">{tb('Created', 'أُنشئ')}: </dt><dd className="inline">{r.createdAt.toISOString().slice(0, 10)}</dd></div>
            {r.depositPiastres != null && <div><dt className="inline text-muted-foreground">{tb('Deposit', 'العربون')}: </dt><dd className="inline">{piastresToEgp(r.depositPiastres)} {tb('EGP', 'ج.م')}</dd></div>}
            {r.autoOptional && <div><dt className="inline text-muted-foreground">{tb('Source', 'المصدر')}: </dt><dd className="inline">{tb('Auto — always-needed refill', 'تلقائي — تجديد مطلوب دائمًا')}</dd></div>}
            {r.notes && <div><dt className="inline text-muted-foreground">{tb('Notes', 'ملاحظات')}: </dt><dd className="inline">{r.notes}</dd></div>}
            {r.status === 'APPROVED' && r.approvedByName && <div><dt className="inline text-muted-foreground">{tb('Approved by', 'اعتمده')}: </dt><dd className="inline">{r.approvedByName}</dd></div>}
            {r.status === 'REJECTED' && r.rejectedNote && <div><dt className="inline text-muted-foreground">{tb('Rejection note', 'سبب الرفض')}: </dt><dd className="inline">{r.rejectedNote}</dd></div>}
          </dl>

          {r.photos.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {r.photos.map((p) => (
                <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="size-16 rounded-md border border-border object-cover" />
                </a>
              ))}
            </div>
          )}

          {/* Approval gate — only while PENDING. */}
          {editable && (
            <div className="mt-4 space-y-3 border-t border-border pt-4">
              <form action={approveRequestAction}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="locale" value={locale} />
                <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">{tb('Approve', 'اعتماد')}</button>
              </form>
              <form action={rejectRequestAction} className="space-y-2">
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="locale" value={locale} />
                <textarea name="note" rows={2} placeholder={tb('Reason for rejection (optional)', 'سبب الرفض (اختياري)')} className={inputCls} />
                <button className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface">{tb('Reject', 'رفض')}</button>
              </form>
            </div>
          )}

          <form action={archiveRequestAction} className="mt-4 border-t border-border pt-4">
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="locale" value={locale} />
            <button className="text-sm text-muted-foreground hover:text-destructive hover:underline">{tb('Archive', 'أرشفة')}</button>
          </form>
        </section>

        <section className="rounded-lg border border-border p-4">
          <h2 className="mb-3 font-heading text-lg font-semibold">{tb('Products', 'المنتجات')}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-2 text-start">{tb('Product', 'المنتج')}</th>
                  <th className="p-2 text-end">{tb('Qty', 'الكمية')}</th>
                  <th className="p-2 text-end">{tb('Selling price', 'سعر البيع')}</th>
                </tr>
              </thead>
              <tbody>
                {r.lines.map((l) => (
                  <tr key={l.id} className="border-t border-border">
                    <td className="p-2">
                      <Link href={`/admin/products/${l.product.id}`} className="text-primary hover:underline">{l.product.nameEn}</Link>
                      <div className="font-mono text-xs text-muted-foreground">{l.product.sku}</div>
                      {l.notes && <div className="text-xs text-muted-foreground">{l.notes}</div>}
                    </td>
                    <td className="p-2 text-end">{l.count}</td>
                    <td className="p-2 text-end">{l.sellingPricePiastres != null ? `${piastresToEgp(l.sellingPricePiastres)} ${tb('EGP', 'ج.م')}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
