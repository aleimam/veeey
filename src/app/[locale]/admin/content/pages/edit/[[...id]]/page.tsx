import { setRequestLocale } from 'next-intl/server';
import { getPage } from '@/lib/content-service';
import { savePageAction } from '@/server/admin-actions';
import { EntityForm, type FieldSpec } from '@/components/admin/entity-form';

const FIELDS: FieldSpec[] = [
  { name: 'titleEn', label: 'العنوان (إنجليزي)', type: 'text', required: true },
  { name: 'titleAr', label: 'العنوان (عربي)', type: 'text' },
  { name: 'slug', label: 'المُعرّف', type: 'slug' },
  { name: 'bodyEn', label: 'النص (إنجليزي)', type: 'textarea' },
  { name: 'bodyAr', label: 'النص (عربي)', type: 'textarea' },
  { name: 'status', label: 'الحالة', type: 'select', options: [{ value: 'DRAFT', label: 'مسودة' }, { value: 'PUBLISHED', label: 'منشور' }, { value: 'ARCHIVED', label: 'مؤرشف' }] },
  { name: 'metaTitleEn', label: 'عنوان السيو (إنجليزي)', type: 'text' },
  { name: 'metaDescEn', label: 'وصف السيو (إنجليزي)', type: 'text' },
];

export default async function PageEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const pageId = id?.[0];
  const page = pageId ? await getPage(pageId) : null;
  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{pageId ? 'تعديل الصفحة' : 'صفحة جديدة'}</h1>
      <EntityForm action={savePageAction} fields={FIELDS} defaults={page ?? {}} id={pageId} locale={locale} listHref="/admin/content/pages" />
    </div>
  );
}
