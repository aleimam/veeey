import { setRequestLocale } from 'next-intl/server';
import { listCoupons } from '@/lib/coupon-service';
import { AdminList } from '@/components/admin/resource-list';

export default async function CouponsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const coupons = await listCoupons();
  return (
    <AdminList
      title="Coupons"
      newHref="/admin/coupons/edit"
      newLabel="New coupon"
      head={['Code', 'Type', 'Value', 'Active']}
      rows={coupons.map((c) => ({
        key: c.id,
        cells: [c.code, c.type, c.type === 'PERCENT' ? `${c.value}%` : `${c.value} EGP`, c.active ? 'Yes' : '—'],
        editHref: `/admin/coupons/edit/${c.id}`,
      }))}
    />
  );
}
