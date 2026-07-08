import { setRequestLocale } from 'next-intl/server';
import { getBrand } from '@/lib/taxonomy-service';
import { saveBrandAction } from '@/server/admin-actions';
import { EntityForm, type FieldSpec } from '@/components/admin/entity-form';
import { SeoEditor } from '@/components/admin/seo-editor';
import { pick } from '@/lib/admin-i18n';

export default async function BrandEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const FIELDS: FieldSpec[] = [
    { name: 'nameEn', label: tb('Name (English)', 'الاسم (بالإنجليزية)'), type: 'text', required: true },
    { name: 'nameAr', label: tb('Name (Arabic)', 'الاسم (بالعربية)'), type: 'text' },
    { name: 'slug', label: tb('Slug', 'المُعرّف'), type: 'slug' },
    { name: 'slugAr', label: tb('Slug (Arabic)', 'المُعرّف (بالعربية)'), type: 'slug' },
    { name: 'descriptionEn', label: tb('Description (English)', 'الوصف (بالإنجليزية)'), type: 'rich', compact: true },
    { name: 'descriptionAr', label: tb('Description (Arabic)', 'الوصف (بالعربية)'), type: 'rich', compact: true },
    { name: 'logoUrl', label: tb('Photo / logo', 'الصورة / الشعار'), type: 'image' },
    { name: 'bannerUrl', label: tb('Banner', 'البانر'), type: 'image' },
  ];
  const brandId = id?.[0];
  const brand = brandId ? await getBrand(brandId) : null;
  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{brandId ? tb('Edit brand', 'تعديل العلامة التجارية') : tb('New brand', 'علامة تجارية جديدة')}</h1>
      <EntityForm
        action={saveBrandAction}
        fields={FIELDS}
        defaults={brand ?? {}}
        id={brandId}
        locale={locale}
        listHref="/admin/brands"
        extra={
          <SeoEditor
            entity="brand"
            schemaInfo={{ name: brand?.nameEn ?? '', image: brand?.logoUrl ?? '' }}
            d={{
              metaTitleEn: brand?.metaTitleEn ?? '', metaTitleAr: brand?.metaTitleAr ?? '',
              metaDescEn: brand?.metaDescEn ?? '', metaDescAr: brand?.metaDescAr ?? '',
              focusKeywordEn: brand?.focusKeywordEn ?? '', focusKeywordAr: brand?.focusKeywordAr ?? '',
              secondaryKeywordsEn: brand?.secondaryKeywordsEn ?? '', secondaryKeywordsAr: brand?.secondaryKeywordsAr ?? '',
              ogTitleEn: brand?.ogTitleEn ?? '', ogTitleAr: brand?.ogTitleAr ?? '',
              ogDescEn: brand?.ogDescEn ?? '', ogDescAr: brand?.ogDescAr ?? '',
              ogImage: brand?.ogImage ?? '',
              canonicalUrl: brand?.canonicalUrl ?? '',
              robotsIndex: brand?.robotsIndex ?? true, robotsFollow: brand?.robotsFollow ?? true,
              schemaOverrides: brand?.schemaOverridesJson ? JSON.stringify(brand.schemaOverridesJson, null, 2) : '',
            }}
          />
        }
      />
    </div>
  );
}
