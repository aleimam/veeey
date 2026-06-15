import { setRequestLocale } from 'next-intl/server';
import { listCoupons } from '@/lib/coupon-service';
import { AdminList } from '@/components/admin/resource-list';
import { RowActions, ArchivedToggle, InUseNotice } from '@/components/admin/row-actions';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CouponsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const showingArchived = one(sp.archived) === '1';
  const all = await listCoupons();
  const coupons = all.filter((c) => (showingArchived ? !c.active : c.active));
  return (
    <AdminList
      title={showingArchived ? 'Coupons (inactive)' : 'Coupons'}
      newHref="/admin/coupons/edit"
      newLabel="New coupon"
      head={['Code', 'Type', 'Value', 'Active']}
      toolbar={<ArchivedToggle path="coupons" showingArchived={showingArchived} />}
      notice={<InUseNotice show={one(sp.error) === 'in_use'} />}
      rows={coupons.map((c) => ({
        key: c.id,
        cells: [c.code, c.type, c.type === 'PERCENT' ? `${c.value}%` : `${c.value} EGP`, c.active ? 'Yes' : '—'],
        editHref: `/admin/coupons/edit/${c.id}`,
        actions: <RowActions entity="coupon" id={c.id} path="coupons" locale={locale} archived={!c.active} />,
      }))}
    />
  );
}
