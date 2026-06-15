import { setRequestLocale } from 'next-intl/server';
import { getTag } from '@/lib/taxonomy-service';
import { saveTagAction } from '@/server/admin-actions';
import { EntityForm, type FieldSpec } from '@/components/admin/entity-form';

const FIELDS: FieldSpec[] = [
  { name: 'nameEn', label: 'الاسم (بالإنجليزية)', type: 'text', required: true },
  { name: 'nameAr', label: 'الاسم (بالعربية)', type: 'text' },
  { name: 'slug', label: 'المُعرّف', type: 'slug' },
];

export default async function TagEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const tagId = id?.[0];
  const tag = tagId ? await getTag(tagId) : null;
  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{tagId ? 'تعديل الوسم' : 'وسم جديد'}</h1>
      <EntityForm action={saveTagAction} fields={FIELDS} defaults={tag ?? {}} id={tagId} locale={locale} listHref="/admin/tags" />
    </div>
  );
}
