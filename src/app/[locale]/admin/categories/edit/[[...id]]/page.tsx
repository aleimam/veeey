import { setRequestLocale } from 'next-intl/server';
import { getCategory, listCategories } from '@/lib/taxonomy-service';
import { saveCategoryAction } from '@/server/admin-actions';
import { EntityForm, type FieldSpec } from '@/components/admin/entity-form';
import { pick } from '@/lib/admin-i18n';

export default async function CategoryEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const categoryId = id?.[0];
  const [category, all] = await Promise.all([
    categoryId ? getCategory(categoryId) : Promise.resolve(null),
    listCategories(),
  ]);
  const parentOptions = [
    { value: '', label: tb('— None —', '— بدون —') },
    ...all.filter((c) => c.id !== categoryId).map((c) => ({ value: c.id, label: c.nameEn })),
  ];

  const fields: FieldSpec[] = [
    { name: 'nameEn', label: tb('Name (English)', 'الاسم (بالإنجليزية)'), type: 'text', required: true },
    { name: 'nameAr', label: tb('Name (Arabic)', 'الاسم (بالعربية)'), type: 'text' },
    { name: 'slug', label: tb('Slug', 'المُعرّف'), type: 'slug' },
    { name: 'parentId', label: tb('Parent category', 'الفئة الأم'), type: 'select', options: parentOptions },
    { name: 'descriptionEn', label: tb('Description (English)', 'الوصف (بالإنجليزية)'), type: 'rich', compact: true },
    { name: 'imageUrl', label: tb('Image URL', 'رابط الصورة'), type: 'text' },
    { name: 'metaTitleEn', label: tb('SEO title (English)', 'عنوان SEO (بالإنجليزية)'), type: 'text' },
    { name: 'metaDescEn', label: tb('SEO description (English)', 'وصف SEO (بالإنجليزية)'), type: 'text' },
  ];

  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{categoryId ? tb('Edit category', 'تعديل الفئة') : tb('New category', 'فئة جديدة')}</h1>
      <EntityForm action={saveCategoryAction} fields={fields} defaults={category ?? {}} id={categoryId} locale={locale} listHref="/admin/categories" />
    </div>
  );
}
