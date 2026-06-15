import { setRequestLocale } from 'next-intl/server';
import { getBrand } from '@/lib/taxonomy-service';
import { saveBrandAction } from '@/server/admin-actions';
import { EntityForm, type FieldSpec } from '@/components/admin/entity-form';

const FIELDS: FieldSpec[] = [
  { name: 'nameEn', label: 'الاسم (بالإنجليزية)', type: 'text', required: true },
  { name: 'nameAr', label: 'الاسم (بالعربية)', type: 'text' },
  { name: 'slug', label: 'المُعرّف', type: 'slug' },
  { name: 'descriptionEn', label: 'الوصف (بالإنجليزية)', type: 'textarea' },
  { name: 'logoUrl', label: 'رابط الشعار', type: 'text' },
  { name: 'metaTitleEn', label: 'عنوان SEO (بالإنجليزية)', type: 'text' },
  { name: 'metaDescEn', label: 'وصف SEO (بالإنجليزية)', type: 'text' },
];

export default async function BrandEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const brandId = id?.[0];
  const brand = brandId ? await getBrand(brandId) : null;
  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{brandId ? 'تعديل العلامة التجارية' : 'علامة تجارية جديدة'}</h1>
      <EntityForm action={saveBrandAction} fields={FIELDS} defaults={brand ?? {}} id={brandId} locale={locale} listHref="/admin/brands" />
    </div>
  );
}
