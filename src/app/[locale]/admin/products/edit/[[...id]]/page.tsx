import { setRequestLocale } from 'next-intl/server';
import { getProduct } from '@/lib/catalog-service';
import { listBrands, listCategories, listTags, listAttributes } from '@/lib/taxonomy-service';
import { piastresToEgp } from '@/lib/format';
import { ProductForm, type ProductDefaults } from '@/components/admin/product-form';

export default async function ProductEditPage({
  params,
}: {
  params: Promise<{ locale: string; id?: string[] }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const productId = id?.[0];

  const [brands, categories, tags, attributes, product] = await Promise.all([
    listBrands(),
    listCategories(),
    listTags(),
    listAttributes(),
    productId ? getProduct(productId) : Promise.resolve(null),
  ]);

  const attributeValues = attributes.flatMap((a) =>
    a.values.map((v) => ({ value: v.id, label: `${a.nameEn}: ${v.valueEn}` })),
  );

  const defaults: ProductDefaults = product
    ? {
        id: product.id,
        sku: product.sku,
        nameEn: product.nameEn,
        nameAr: product.nameAr ?? '',
        slugEn: product.slugEn,
        slugAr: product.slugAr ?? '',
        kind: product.kind,
        status: product.status,
        brandId: product.brandId,
        productType: product.productType,
        basePriceEgp: piastresToEgp(product.basePricePiastres),
        weightG: product.weightG,
        servingsPerUnit: product.servingsPerUnit,
        dailyDosage: product.dailyDosage,
        shortDescEn: product.shortDescEn ?? '',
        shortDescAr: product.shortDescAr ?? '',
        longDescEn: product.longDescEn ?? '',
        longDescAr: product.longDescAr ?? '',
        metaTitleEn: product.metaTitleEn ?? '',
        metaDescEn: product.metaDescEn ?? '',
        aiSummaryEn: product.aiSummaryEn ?? '',
        categoryIds: product.categories.map((c) => c.id),
        tagIds: product.tags.map((t) => t.id),
        attributeValueIds: product.attributeValues.map((av) => av.attributeValueId),
        imageUrls: product.images.map((i) => i.url),
        restricted: product.restricted,
        restrictHideCatalog: product.restrictHideCatalog,
        restrictHideFeeds: product.restrictHideFeeds,
        restrictDisableCards: product.restrictDisableCards,
        restrictRequireLogin: product.restrictRequireLogin,
        restrictAgeConsent: product.restrictAgeConsent,
      }
    : {};

  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">
        {productId ? 'Edit product' : 'New product'}
      </h1>
      <ProductForm
        locale={locale}
        defaults={defaults}
        brands={brands.map((b) => ({ value: b.id, label: b.nameEn }))}
        categories={categories.map((c) => ({ value: c.id, label: c.nameEn }))}
        tags={tags.map((t) => ({ value: t.id, label: t.nameEn }))}
        attributeValues={attributeValues}
      />
    </div>
  );
}
