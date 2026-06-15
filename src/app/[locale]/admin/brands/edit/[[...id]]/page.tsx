import { setRequestLocale } from 'next-intl/server';
import { getBrand } from '@/lib/taxonomy-service';
import { saveBrandAction } from '@/server/admin-actions';
import { EntityForm, type FieldSpec } from '@/components/admin/entity-form';
import { pick } from '@/lib/admin-i18n';

export default async function BrandEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const FIELDS: FieldSpec[] = [
    { name: 'nameEn', label: tb('Name (English)', 'الاسم (بالإنجليزية)'), type: 'text', required: true },
    { name: 'nameAr', label: tb('Name (Arabic)', 'الاسم (بالعربية)'), type: 'text' },
    { name: 'slug', label: tb('Slug', 'المُعرّف'), type: 'slug' },
    { name: 'descriptionEn', label: tb('Description (English)', 'الوصف (بالإنجليزية)'), type: 'textarea' },
    { name: 'logoUrl', label: tb('Logo URL', 'رابط الشعار'), type: 'text' },
    { name: 'metaTitleEn', label: tb('SEO title (English)', 'عنوان SEO (بالإنجليزية)'), type: 'text' },
    { name: 'metaDescEn', label: tb('SEO description (English)', 'وصف SEO (بالإنجليزية)'), type: 'text' },
  ];
  const brandId = id?.[0];
  const brand = brandId ? await getBrand(brandId) : null;
  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{brandId ? tb('Edit brand', 'تعديل العلامة التجارية') : tb('New brand', 'علامة تجارية جديدة')}</h1>
      <EntityForm action={saveBrandAction} fields={FIELDS} defaults={brand ?? {}} id={brandId} locale={locale} listHref="/admin/brands" />
    </div>
  );
}
