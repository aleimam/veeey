import { setRequestLocale } from 'next-intl/server';
import { getCoupon } from '@/lib/coupon-service';
import { saveCouponAction } from '@/server/loyalty-actions';
import { EntityForm, type FieldSpec } from '@/components/admin/entity-form';
import { piastresToEgp } from '@/lib/format';

const FIELDS: FieldSpec[] = [
  { name: 'code', label: 'Code', type: 'text', required: true },
  { name: 'type', label: 'Type', type: 'select', options: [{ value: 'PERCENT', label: 'Percent off' }, { value: 'FIXED', label: 'Fixed EGP off' }, { value: 'FREE_ITEM', label: 'Free item' }] },
  { name: 'value', label: 'Value (% or EGP)', type: 'text' },
  { name: 'minSpendEgp', label: 'Minimum spend (EGP)', type: 'text' },
  { name: 'firstOrderOnly', label: 'First order only', type: 'checkbox' },
  { name: 'singleUse', label: 'Single use', type: 'checkbox' },
  { name: 'usageLimit', label: 'Total usage limit', type: 'text' },
  { name: 'perCustomerLimit', label: 'Per-customer limit', type: 'text' },
  { name: 'stackable', label: 'Stacks with points/tier', type: 'checkbox' },
  { name: 'startsAt', label: 'Starts (YYYY-MM-DD)', type: 'text' },
  { name: 'endsAt', label: 'Ends (YYYY-MM-DD)', type: 'text' },
  { name: 'active', label: 'Active', type: 'checkbox' },
];

export default async function CouponEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const couponId = id?.[0];
  const coupon = couponId ? await getCoupon(couponId) : null;
  const defaults = coupon
    ? {
        ...coupon,
        minSpendEgp: coupon.minSpendPiastres != null ? piastresToEgp(coupon.minSpendPiastres) : '',
        startsAt: coupon.startsAt ? coupon.startsAt.toISOString().slice(0, 10) : '',
        endsAt: coupon.endsAt ? coupon.endsAt.toISOString().slice(0, 10) : '',
      }
    : { stackable: true, active: true };
  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{couponId ? 'Edit coupon' : 'New coupon'}</h1>
      <EntityForm action={saveCouponAction} fields={FIELDS} defaults={defaults} id={couponId} locale={locale} listHref="/admin/coupons" />
    </div>
  );
}
