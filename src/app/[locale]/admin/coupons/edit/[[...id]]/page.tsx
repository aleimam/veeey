import { setRequestLocale } from 'next-intl/server';
import { getCoupon } from '@/lib/coupon-service';
import { saveCouponAction } from '@/server/loyalty-actions';
import { EntityForm, type FieldSpec } from '@/components/admin/entity-form';
import { piastresToEgp } from '@/lib/format';
import { pick, type Pick } from '@/lib/admin-i18n';

const buildFields = (tb: Pick): FieldSpec[] => [
  { name: 'code', label: tb('Code', 'الكود'), type: 'text', required: true },
  { name: 'type', label: tb('Type', 'النوع'), type: 'select', options: [{ value: 'PERCENT', label: tb('Percentage discount', 'خصم نسبة') }, { value: 'FIXED', label: tb('Fixed amount discount in EGP', 'خصم مبلغ ثابت بالـ ج.م') }, { value: 'FREE_ITEM', label: tb('Free item', 'منتج مجاني') }] },
  { name: 'value', label: tb('Value (% or EGP)', 'القيمة (% أو ج.م)'), type: 'text' },
  { name: 'minSpendEgp', label: tb('Minimum spend (EGP)', 'الحد الأدنى للإنفاق (ج.م)'), type: 'text' },
  { name: 'firstOrderOnly', label: tb('First order only', 'أول طلب فقط'), type: 'checkbox' },
  { name: 'singleUse', label: tb('Single use', 'استخدام واحد'), type: 'checkbox' },
  { name: 'usageLimit', label: tb('Total usage limit', 'الحد الأقصى لإجمالي الاستخدام'), type: 'text' },
  { name: 'perCustomerLimit', label: tb('Per-customer limit', 'الحد لكل عميل'), type: 'text' },
  { name: 'stackable', label: tb('Stacks with points/tier', 'يُجمع مع النقاط/الفئة'), type: 'checkbox' },
  { name: 'startsAt', label: tb('Starts (YYYY-MM-DD)', 'يبدأ (YYYY-MM-DD)'), type: 'text' },
  { name: 'endsAt', label: tb('Ends (YYYY-MM-DD)', 'ينتهي (YYYY-MM-DD)'), type: 'text' },
  { name: 'active', label: tb('Active', 'مُفعّل'), type: 'checkbox' },
];

export default async function CouponEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const FIELDS = buildFields(tb);
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
      <h1 className="mb-6 font-heading text-xl font-semibold">{couponId ? tb('Edit coupon', 'تعديل الكوبون') : tb('New coupon', 'كوبون جديد')}</h1>
      <EntityForm action={saveCouponAction} fields={FIELDS} defaults={defaults} id={couponId} locale={locale} listHref="/admin/coupons" />
    </div>
  );
}
