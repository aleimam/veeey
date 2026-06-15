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
    { value: '', label: '— بدون —' },
    ...all.filter((c) => c.id !== categoryId).map((c) => ({ value: c.id, label: c.nameEn })),
  ];

  const fields: FieldSpec[] = [
    { name: 'nameEn', label: 'الاسم (بالإنجليزية)', type: 'text', required: true },
    { name: 'nameAr', label: 'الاسم (بالعربية)', type: 'text' },
    { name: 'slug', label: 'المُعرّف', type: 'slug' },
    { name: 'parentId', label: 'الفئة الأم', type: 'select', options: parentOptions },
    { name: 'descriptionEn', label: 'الوصف (بالإنجليزية)', type: 'textarea' },
    { name: 'imageUrl', label: 'رابط الصورة', type: 'text' },
    { name: 'metaTitleEn', label: 'عنوان SEO (بالإنجليزية)', type: 'text' },
    { name: 'metaDescEn', label: 'وصف SEO (بالإنجليزية)', type: 'text' },
  ];

  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{categoryId ? 'تعديل الفئة' : 'فئة جديدة'}</h1>
      <EntityForm action={saveCategoryAction} fields={fields} defaults={category ?? {}} id={categoryId} locale={locale} listHref="/admin/categories" />
    </div>
  );
}
