import { setRequestLocale } from 'next-intl/server';
import { listReturns } from '@/lib/return-service';
import { AdminList } from '@/components/admin/resource-list';
import { StatusBadge } from '@/components/admin/ui';

export default async function ReturnsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const returns = await listReturns();
  return (
    <AdminList
      title="Returns"
      newHref="/admin/returns"
      newLabel="Returns"
      head={['Order', 'Reason', 'Items', 'Status', 'Date']}
      rows={returns.map((r) => ({
        key: r.id,
        cells: [r.order.number, r.reasonCode, String(r.items.length), <StatusBadge key="s" status={r.status} />, r.createdAt.toISOString().slice(0, 10)],
        editHref: `/admin/returns/${r.id}`,
      }))}
    />
  );
}
