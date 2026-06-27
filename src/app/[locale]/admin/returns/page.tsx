import { setRequestLocale } from 'next-intl/server';
import { listReturns } from '@/lib/return-service';
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
  const lp = parseListParams(sp, { sortable: ['order', 'status', 'date'], defaultSort: 'date', defaultDir: 'desc' });
  const all = await listReturns({ status, q });
  const { rows: returns, total } = clientPage(all, lp, { order: (r) => r.order.number, status: (r) => r.status, date: (r) => r.createdAt.getTime() });
  const basePath = `/${locale}/admin/returns`;

  return (
    <div>
      <FilterBar
        fields={[
          { name: 'q', label: tb('Order number', 'رقم الطلب'), type: 'text', placeholder: tb('Order number', 'رقم الطلب') },
          { name: 'status', label: tb('Status', 'الحالة'), type: 'select', options: RETURN_STATUSES.map((s) => ({ value: s, label: s })) },
        ]}
        values={{ q, status }}
        locale={locale}
        path="returns"
      />
      <AdminList
        title={tb('Returns', 'المرتجعات')}
        newHref="/admin/returns"
        newLabel={tb('Returns', 'المرتجعات')}
        count={total}
        toolbar={<ExportBar entity="returns" locale={locale} query={exportQs(sp)} />}
        head={[{ label: tb('Order', 'الطلب'), col: 'order' }, tb('Reason', 'السبب'), tb('Items', 'العناصر'), { label: tb('Status', 'الحالة'), col: 'status' }, { label: tb('Date', 'التاريخ'), col: 'date' }]}
        sortCtx={{ sort: lp.sort, dir: lp.dir, sp, basePath }}
        pagination={{ page: lp.page, perPage: lp.perPage, total, sp, basePath, locale }}
        rows={returns.map((r) => ({
          key: r.id,
          cells: [r.order.number, r.reasonCode, String(r.items.length), <StatusBadge key="s" status={r.status} />, r.createdAt.toISOString().slice(0, 10)],
          editHref: `/admin/returns/${r.id}`,
        }))}
      />
    </div>
  );
}
