import { setRequestLocale } from 'next-intl/server';
import { getGift } from '@/lib/gift-service';
import { saveGiftAction } from '@/server/order-actions';
import { EntityForm, type FieldSpec } from '@/components/admin/entity-form';
import { piastresToEgp } from '@/lib/format';

const FIELDS: FieldSpec[] = [
  { name: 'code', label: 'الكود (Gx-…)', type: 'text', required: true },
  { name: 'internalName', label: 'الاسم الداخلي', type: 'text', required: true },
  { name: 'stock', label: 'المخزون', type: 'text' },
  { name: 'expiry', label: 'تاريخ الصلاحية (YYYY-MM-DD)', type: 'text' },
  { name: 'costEgp', label: 'التكلفة (ج.م)', type: 'text' },
];

export default async function GiftEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const giftId = id?.[0];
  const gift = giftId ? await getGift(giftId) : null;
  const defaults = gift
    ? { ...gift, expiry: gift.expiry ? gift.expiry.toISOString().slice(0, 10) : '', costEgp: gift.costPiastres != null ? piastresToEgp(gift.costPiastres) : '' }
    : {};
  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{giftId ? 'تعديل هدية' : 'هدية جديدة'}</h1>
      <EntityForm action={saveGiftAction} fields={FIELDS} defaults={defaults} id={giftId} locale={locale} listHref="/admin/gifts" />
    </div>
  );
}
