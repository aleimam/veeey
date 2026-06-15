import { setRequestLocale } from 'next-intl/server';
import { getPage } from '@/lib/content-service';
import { savePageAction } from '@/server/admin-actions';
import { EntityForm, type FieldSpec } from '@/components/admin/entity-form';
import { pick } from '@/lib/admin-i18n';

export default async function PageEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const FIELDS: FieldSpec[] = [
    { name: 'titleEn', label: tb('Title (English)', 'العنوان (إنجليزي)'), type: 'text', required: true },
    { name: 'titleAr', label: tb('Title (Arabic)', 'العنوان (عربي)'), type: 'text' },
    { name: 'slug', label: tb('Slug', 'المُعرّف'), type: 'slug' },
    { name: 'bodyEn', label: tb('Body (English)', 'النص (إنجليزي)'), type: 'textarea' },
    { name: 'bodyAr', label: tb('Body (Arabic)', 'النص (عربي)'), type: 'textarea' },
    { name: 'status', label: tb('Status', 'الحالة'), type: 'select', options: [{ value: 'DRAFT', label: tb('Draft', 'مسودة') }, { value: 'PUBLISHED', label: tb('Published', 'منشور') }, { value: 'ARCHIVED', label: tb('Archived', 'مؤرشف') }] },
    { name: 'metaTitleEn', label: tb('SEO title (English)', 'عنوان السيو (إنجليزي)'), type: 'text' },
    { name: 'metaDescEn', label: tb('SEO description (English)', 'وصف السيو (إنجليزي)'), type: 'text' },
  ];
  const pageId = id?.[0];
  const page = pageId ? await getPage(pageId) : null;
  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{pageId ? tb('Edit page', 'تعديل الصفحة') : tb('New page', 'صفحة جديدة')}</h1>
      <EntityForm action={savePageAction} fields={FIELDS} defaults={page ?? {}} id={pageId} locale={locale} listHref="/admin/content/pages" />
    </div>
  );
}
