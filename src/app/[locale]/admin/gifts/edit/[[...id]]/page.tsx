import { setRequestLocale } from 'next-intl/server';
import { getGift } from '@/lib/gift-service';
import { saveGiftAction } from '@/server/order-actions';
import { EntityForm, type FieldSpec } from '@/components/admin/entity-form';
import { piastresToEgp } from '@/lib/format';
import { pick, type Pick } from '@/lib/admin-i18n';

const fields = (tb: Pick): FieldSpec[] => [
  { name: 'code', label: tb('Code (Gx-…)', 'الكود (Gx-…)'), type: 'text', required: true },
  { name: 'internalName', label: tb('Internal name', 'الاسم الداخلي'), type: 'text', required: true },
  { name: 'stock', label: tb('Stock', 'المخزون'), type: 'text' },
  { name: 'expiry', label: tb('Expiry date (YYYY-MM-DD)', 'تاريخ الصلاحية (YYYY-MM-DD)'), type: 'text' },
  { name: 'costEgp', label: tb('Cost (EGP)', 'التكلفة (ج.م)'), type: 'text' },
];

export default async function GiftEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const giftId = id?.[0];
  const gift = giftId ? await getGift(giftId) : null;
  const defaults = gift
    ? { ...gift, expiry: gift.expiry ? gift.expiry.toISOString().slice(0, 10) : '', costEgp: gift.costPiastres != null ? piastresToEgp(gift.costPiastres) : '' }
    : {};
  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{giftId ? tb('Edit gift', 'تعديل هدية') : tb('New gift', 'هدية جديدة')}</h1>
      <EntityForm action={saveGiftAction} fields={fields(tb)} defaults={defaults} id={giftId} locale={locale} listHref="/admin/gifts" />
    </div>
  );
}
