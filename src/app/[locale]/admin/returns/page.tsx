import { setRequestLocale } from 'next-intl/server';
import { listReturns } from '@/lib/return-service';
import { AdminList } from '@/components/admin/resource-list';
import { StatusBadge } from '@/components/admin/ui';
import { ExportBar } from '@/components/admin/export-bar';
import { pick } from '@/lib/admin-i18n';

export default async function ReturnsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const returns = await listReturns();
  return (
    <AdminList
      title={tb('Returns', 'المرتجعات')}
      newHref="/admin/returns"
      newLabel={tb('Returns', 'المرتجعات')}
      toolbar={<ExportBar entity="returns" locale={locale} query="" />}
      head={[tb('Order', 'الطلب'), tb('Reason', 'السبب'), tb('Items', 'العناصر'), tb('Status', 'الحالة'), tb('Date', 'التاريخ')]}
      rows={returns.map((r) => ({
        key: r.id,
        cells: [r.order.number, r.reasonCode, String(r.items.length), <StatusBadge key="s" status={r.status} />, r.createdAt.toISOString().slice(0, 10)],
        editHref: `/admin/returns/${r.id}`,
      }))}
    />
  );
}
