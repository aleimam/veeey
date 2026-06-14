import { setRequestLocale } from 'next-intl/server';
import { getPage } from '@/lib/content-service';
import { savePageAction } from '@/server/admin-actions';
import { EntityForm, type FieldSpec } from '@/components/admin/entity-form';

const FIELDS: FieldSpec[] = [
  { name: 'titleEn', label: 'Title (English)', type: 'text', required: true },
  { name: 'titleAr', label: 'Title (Arabic)', type: 'text' },
  { name: 'slug', label: 'Slug', type: 'slug' },
  { name: 'bodyEn', label: 'Body (EN)', type: 'textarea' },
  { name: 'bodyAr', label: 'Body (AR)', type: 'textarea' },
  { name: 'status', label: 'Status', type: 'select', options: [{ value: 'DRAFT', label: 'Draft' }, { value: 'PUBLISHED', label: 'Published' }, { value: 'ARCHIVED', label: 'Archived' }] },
  { name: 'metaTitleEn', label: 'SEO title (EN)', type: 'text' },
  { name: 'metaDescEn', label: 'SEO description (EN)', type: 'text' },
];

export default async function PageEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const pageId = id?.[0];
  const page = pageId ? await getPage(pageId) : null;
  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{pageId ? 'Edit page' : 'New page'}</h1>
      <EntityForm action={savePageAction} fields={FIELDS} defaults={page ?? {}} id={pageId} locale={locale} listHref="/admin/content/pages" />
    </div>
  );
}
