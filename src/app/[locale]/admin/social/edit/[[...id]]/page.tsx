import { setRequestLocale } from 'next-intl/server';
import { getSocialLink, SOCIAL_PLATFORMS } from '@/lib/social-service';
import { saveSocialLinkAction } from '@/server/social-actions';
import { EntityForm, type FieldSpec } from '@/components/admin/entity-form';
import { pick } from '@/lib/admin-i18n';

export default async function SocialEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const FIELDS: FieldSpec[] = [
    { name: 'platform', label: tb('Platform', 'المنصة'), type: 'select', options: SOCIAL_PLATFORMS.map((p) => ({ value: p.value, label: p.label })) },
    { name: 'label', label: tb('Label (optional — required for "Other")', 'التسمية (اختياري — مطلوبة لـ «أخرى»)'), type: 'text' },
    { name: 'url', label: tb('URL', 'الرابط'), type: 'text', required: true },
    { name: 'sortOrder', label: tb('Order', 'الترتيب'), type: 'text', hint: tb('Lower shows first.', 'الأقل يظهر أولًا.') },
    { name: 'active', label: tb('Active (show in footer)', 'نشط (إظهار في التذييل)'), type: 'checkbox' },
  ];
  const sid = id?.[0];
  const link = sid ? await getSocialLink(sid) : null;
  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{sid ? tb('Edit social link', 'تعديل رابط التواصل') : tb('New social link', 'رابط تواصل جديد')}</h1>
      <EntityForm
        action={saveSocialLinkAction}
        fields={FIELDS}
        defaults={link ?? { active: true, sortOrder: 0 }}
        id={sid}
        locale={locale}
        listHref="/admin/social"
      />
    </div>
  );
}
