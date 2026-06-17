import { setRequestLocale } from 'next-intl/server';
import { listReturns } from '@/lib/return-service';
import { AdminList } from '@/components/admin/resource-list';
import { StatusBadge } from '@/components/admin/ui';
import { ExportBar, exportQs } from '@/components/admin/export-bar';
import { FilterBar } from '@/components/admin/filter-bar';
import { pick } from '@/lib/admin-i18n';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

const RETURN_STATUSES = ['REQUESTED', 'APPROVED', 'QUARANTINE', 'RESTOCKED', 'WRITTEN_OFF', 'REFUNDED', 'REJECTED'];

export default async function ReturnsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const q = one(sp.q);
  const status = one(sp.status);
  const returns = await listReturns({ status, q });
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
        toolbar={<ExportBar entity="returns" locale={locale} query={exportQs(sp)} />}
        head={[tb('Order', 'الطلب'), tb('Reason', 'السبب'), tb('Items', 'العناصر'), tb('Status', 'الحالة'), tb('Date', 'التاريخ')]}
        rows={returns.map((r) => ({
          key: r.id,
          cells: [r.order.number, r.reasonCode, String(r.items.length), <StatusBadge key="s" status={r.status} />, r.createdAt.toISOString().slice(0, 10)],
          editHref: `/admin/returns/${r.id}`,
        }))}
      />
    </div>
  );
}
