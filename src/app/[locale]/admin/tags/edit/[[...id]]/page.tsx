import { setRequestLocale } from 'next-intl/server';
import { getTag } from '@/lib/taxonomy-service';
import { saveTagAction } from '@/server/admin-actions';
import { EntityForm, type FieldSpec } from '@/components/admin/entity-form';
import { pick } from '@/lib/admin-i18n';

export default async function TagEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const FIELDS: FieldSpec[] = [
    { name: 'nameEn', label: tb('Name (English)', 'الاسم (بالإنجليزية)'), type: 'text', required: true },
    { name: 'nameAr', label: tb('Name (Arabic)', 'الاسم (بالعربية)'), type: 'text' },
    { name: 'slug', label: tb('Slug', 'المُعرّف'), type: 'slug' },
  ];
  const tagId = id?.[0];
  const tag = tagId ? await getTag(tagId) : null;
  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{tagId ? tb('Edit tag', 'تعديل الوسم') : tb('New tag', 'وسم جديد')}</h1>
      <EntityForm action={saveTagAction} fields={FIELDS} defaults={tag ?? {}} id={tagId} locale={locale} listHref="/admin/tags" slugEntity="tag" />
    </div>
  );
}
