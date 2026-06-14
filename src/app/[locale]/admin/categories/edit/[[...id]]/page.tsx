import { setRequestLocale } from 'next-intl/server';
import { getCategory, listCategories } from '@/lib/taxonomy-service';
import { saveCategoryAction } from '@/server/admin-actions';
import { EntityForm, type FieldSpec } from '@/components/admin/entity-form';

export default async function CategoryEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const categoryId = id?.[0];
  const [category, all] = await Promise.all([
    categoryId ? getCategory(categoryId) : Promise.resolve(null),
    listCategories(),
  ]);
  const parentOptions = [
    { value: '', label: '— none —' },
    ...all.filter((c) => c.id !== categoryId).map((c) => ({ value: c.id, label: c.nameEn })),
  ];

  const fields: FieldSpec[] = [
    { name: 'nameEn', label: 'Name (English)', type: 'text', required: true },
    { name: 'nameAr', label: 'Name (Arabic)', type: 'text' },
    { name: 'slug', label: 'Slug', type: 'slug' },
    { name: 'parentId', label: 'Parent category', type: 'select', options: parentOptions },
    { name: 'descriptionEn', label: 'Description (EN)', type: 'textarea' },
    { name: 'imageUrl', label: 'Image URL', type: 'text' },
    { name: 'metaTitleEn', label: 'SEO title (EN)', type: 'text' },
    { name: 'metaDescEn', label: 'SEO description (EN)', type: 'text' },
  ];

  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{categoryId ? 'Edit category' : 'New category'}</h1>
      <EntityForm action={saveCategoryAction} fields={fields} defaults={category ?? {}} id={categoryId} locale={locale} listHref="/admin/categories" />
    </div>
  );
}
