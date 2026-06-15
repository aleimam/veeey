import { setRequestLocale } from 'next-intl/server';
import { getTrustBadge } from '@/lib/home-extras-service';
import { saveTrustBadgeAction } from '@/server/home-extras-actions';
import { EntityForm, type FieldSpec } from '@/components/admin/entity-form';
import { pick } from '@/lib/admin-i18n';

export default async function TrustBadgeEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const FIELDS: FieldSpec[] = [
    { name: 'labelEn', label: tb('Label (English)', 'التسمية (إنجليزي)'), type: 'text', required: true },
    { name: 'labelAr', label: tb('Label (Arabic)', 'التسمية (عربي)'), type: 'text' },
    { name: 'sortOrder', label: tb('Order', 'الترتيب'), type: 'text' },
    { name: 'active', label: tb('Active', 'نشط'), type: 'checkbox' },
  ];
  const bid = id?.[0];
  const item = bid ? await getTrustBadge(bid) : null;
  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{bid ? tb('Edit trust badge', 'تعديل شارة الثقة') : tb('New trust badge', 'شارة ثقة جديدة')}</h1>
      <EntityForm action={saveTrustBadgeAction} fields={FIELDS} defaults={item ?? { active: true, sortOrder: 0 }} id={bid} locale={locale} listHref="/admin/homepage/trust" />
    </div>
  );
}
