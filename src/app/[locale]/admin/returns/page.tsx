import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listReturns } from '@/lib/return-service';
import { listReturnReasons } from '@/lib/return-reason-service';
import { AdminList } from '@/components/admin/resource-list';
import { StatusBadge } from '@/components/admin/ui';
import { ExportBar, exportQs } from '@/components/admin/export-bar';
import { FilterBar } from '@/components/admin/filter-bar';
import { parseListParams, clientPage, type SP } from '@/lib/admin-list';
import { pick } from '@/lib/admin-i18n';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const RETURN_STATUSES = ['REQUESTED', 'APPROVED', 'QUARANTINE', 'RESTOCKED', 'WRITTEN_OFF', 'REFUNDED', 'REJECTED'];

export default async function ReturnsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const q = one(sp.q);
  const status = one(sp.status);
  const reason = one(sp.reason);
  const lp = parseListParams(sp, { sortable: ['order', 'reason', 'status', 'date'], defaultSort: 'date', defaultDir: 'desc' });
  const [all, reasons] = await Promise.all([listReturns({ status, q, reasonId: reason }), listReturnReasons(false)]);
  const reasonText = (r: (typeof all)[number]) =>
    (r.reason ? (locale === 'ar' ? r.reason.labelAr : r.reason.labelEn) : r.reasonCode) || '—';
  const { rows: returns, total } = clientPage(all, lp, {
    order: (r) => r.order.number,
    reason: (r) => reasonText(r),
    status: (r) => r.status,
    date: (r) => r.createdAt.getTime(),
  });
  const basePath = `/${locale}/admin/returns`;

  return (
    <div>
      <FilterBar
        fields={[
          { name: 'q', label: tb('Search', 'بحث'), type: 'text', placeholder: tb('Order # or customer', 'رقم الطلب أو العميل') },
          { name: 'status', label: tb('Status', 'الحالة'), type: 'select', options: RETURN_STATUSES.map((s) => ({ value: s, label: s })) },
          { name: 'reason', label: tb('Reason', 'السبب'), type: 'select', options: reasons.map((r) => ({ value: r.id, label: locale === 'ar' ? r.labelAr : r.labelEn })) },
        ]}
        values={{ q, status, reason }}
        locale={locale}
        path="returns"
      />
      <AdminList
        title={tb('Returns', 'المرتجعات')}
        newHref="/admin/returns/reasons"
        newLabel={tb('Manage reasons', 'إدارة الأسباب')}
        count={total}
        toolbar={<ExportBar entity="returns" locale={locale} query={exportQs(sp)} />}
        head={[
          { label: tb('Order', 'الطلب'), col: 'order' },
          tb('Customer', 'العميل'),
          { label: tb('Reason', 'السبب'), col: 'reason' },
          tb('Items', 'العناصر'),
          { label: tb('Status', 'الحالة'), col: 'status' },
          { label: tb('Date', 'التاريخ'), col: 'date' },
        ]}
        sortCtx={{ sort: lp.sort, dir: lp.dir, sp, basePath }}
        pagination={{ page: lp.page, perPage: lp.perPage, total, sp, basePath, locale }}
        emptyState={
          <>
            {tb('No returns yet.', 'لا توجد مرتجعات بعد.')}{' '}
            {tb('Customers request returns from their account after delivery; reasons come from ', 'يطلب العملاء الإرجاع من حساباتهم بعد التسليم؛ وتأتي الأسباب من ')}
            <Link href="/admin/returns/reasons" className="text-primary hover:underline">{tb('Manage reasons', 'إدارة الأسباب')}</Link>.
          </>
        }
        rows={returns.map((r) => ({
          key: r.id,
          cells: [
            <Link key="o" href={`/admin/orders/${r.order.id}`} className="text-primary hover:underline">{r.order.number}</Link>,
            r.customer ? ([r.customer.firstName, r.customer.lastName].filter(Boolean).join(' ') || r.customer.user?.email || '—') : tb('Guest', 'زائر'),
            r.reasonNote ? `${reasonText(r)} — ${r.reasonNote}` : reasonText(r),
            String(r.items.length),
            <StatusBadge key="s" status={r.status} />,
            r.createdAt.toISOString().slice(0, 10),
          ],
          editHref: `/admin/returns/${r.id}`,
        }))}
      />
    </div>
  );
}
