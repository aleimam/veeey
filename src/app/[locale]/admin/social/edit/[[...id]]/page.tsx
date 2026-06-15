import { setRequestLocale } from 'next-intl/server';
import { getSocialLink, SOCIAL_PLATFORMS } from '@/lib/social-service';
import { saveSocialLinkAction } from '@/server/social-actions';
import { EntityForm, type FieldSpec } from '@/components/admin/entity-form';

const FIELDS: FieldSpec[] = [
  { name: 'platform', label: 'Platform', type: 'select', options: SOCIAL_PLATFORMS.map((p) => ({ value: p.value, label: p.label })) },
  { name: 'label', label: 'Label (optional — required for "Other")', type: 'text' },
  { name: 'url', label: 'URL', type: 'text', required: true },
  { name: 'sortOrder', label: 'Sort order', type: 'text', hint: 'Lower shows first.' },
  { name: 'active', label: 'Active (show in footer)', type: 'checkbox' },
];

export default async function SocialEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const sid = id?.[0];
  const link = sid ? await getSocialLink(sid) : null;
  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{sid ? 'Edit social link' : 'New social link'}</h1>
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
