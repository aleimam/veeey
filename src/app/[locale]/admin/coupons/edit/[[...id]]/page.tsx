import { setRequestLocale } from 'next-intl/server';
import { getCoupon } from '@/lib/coupon-service';
import { saveCouponAction } from '@/server/loyalty-actions';
import { EntityForm, type FieldSpec } from '@/components/admin/entity-form';
import { piastresToEgp } from '@/lib/format';

const FIELDS: FieldSpec[] = [
  { name: 'code', label: 'الكود', type: 'text', required: true },
  { name: 'type', label: 'النوع', type: 'select', options: [{ value: 'PERCENT', label: 'خصم نسبة' }, { value: 'FIXED', label: 'خصم مبلغ ثابت بالـ ج.م' }, { value: 'FREE_ITEM', label: 'منتج مجاني' }] },
  { name: 'value', label: 'القيمة (% أو ج.م)', type: 'text' },
  { name: 'minSpendEgp', label: 'الحد الأدنى للإنفاق (ج.م)', type: 'text' },
  { name: 'firstOrderOnly', label: 'أول طلب فقط', type: 'checkbox' },
  { name: 'singleUse', label: 'استخدام واحد', type: 'checkbox' },
  { name: 'usageLimit', label: 'الحد الأقصى لإجمالي الاستخدام', type: 'text' },
  { name: 'perCustomerLimit', label: 'الحد لكل عميل', type: 'text' },
  { name: 'stackable', label: 'يُجمع مع النقاط/الفئة', type: 'checkbox' },
  { name: 'startsAt', label: 'يبدأ (YYYY-MM-DD)', type: 'text' },
  { name: 'endsAt', label: 'ينتهي (YYYY-MM-DD)', type: 'text' },
  { name: 'active', label: 'مُفعّل', type: 'checkbox' },
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
      <h1 className="mb-6 font-heading text-xl font-semibold">{couponId ? 'تعديل الكوبون' : 'كوبون جديد'}</h1>
      <EntityForm action={saveCouponAction} fields={FIELDS} defaults={defaults} id={couponId} locale={locale} listHref="/admin/coupons" />
    </div>
  );
}
