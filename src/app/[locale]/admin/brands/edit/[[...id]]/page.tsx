import { setRequestLocale } from 'next-intl/server';
import { getBrand } from '@/lib/taxonomy-service';
import { saveBrandAction } from '@/server/admin-actions';
import { EntityForm, type FieldSpec } from '@/components/admin/entity-form';

const FIELDS: FieldSpec[] = [
  { name: 'nameEn', label: 'Name (English)', type: 'text', required: true },
  { name: 'nameAr', label: 'Name (Arabic)', type: 'text' },
  { name: 'slug', label: 'Slug', type: 'slug' },
  { name: 'descriptionEn', label: 'Description (EN)', type: 'textarea' },
  { name: 'logoUrl', label: 'Logo URL', type: 'text' },
  { name: 'metaTitleEn', label: 'SEO title (EN)', type: 'text' },
  { name: 'metaDescEn', label: 'SEO description (EN)', type: 'text' },
];

export default async function BrandEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const brandId = id?.[0];
  const brand = brandId ? await getBrand(brandId) : null;
  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{brandId ? 'Edit brand' : 'New brand'}</h1>
      <EntityForm action={saveBrandAction} fields={FIELDS} defaults={brand ?? {}} id={brandId} locale={locale} listHref="/admin/brands" />
    </div>
  );
}
