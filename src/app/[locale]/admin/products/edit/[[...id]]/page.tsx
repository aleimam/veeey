import { setRequestLocale } from 'next-intl/server';
import { getProduct } from '@/lib/catalog-service';
import { listBrands, listCategories, listTags, listAttributes } from '@/lib/taxonomy-service';
import { listProductLots } from '@/lib/inventory-service';
import { listLocations } from '@/lib/location-service';
import { getCurrentUser } from '@/lib/auth-guards';
import { hasPermission } from '@/lib/rbac';
import { piastresToEgp } from '@/lib/format';
import { ProductForm, type ProductDefaults } from '@/components/admin/product-form';
import { ProductStock } from '@/components/admin/product-stock';
import { ChangeHistory } from '@/components/admin/change-history';
import { Link } from '@/i18n/navigation';
import { pick } from '@/lib/admin-i18n';

export default async function ProductEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, id } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const productId = id?.[0];

  const [brands, categories, tags, attributes, product, user] = await Promise.all([
    listBrands(),
    listCategories(),
    listTags(),
    listAttributes(),
    productId ? getProduct(productId) : Promise.resolve(null),
    getCurrentUser(),
  ]);

  const [lots, locations] = product
    ? await Promise.all([listProductLots(product.id), listLocations()])
    : [[], []];
  const canStock = hasPermission(user?.permissions ?? [], 'inventory.manage');
  const lotMsg = Array.isArray(sp.lot) ? sp.lot[0] : sp.lot;

  const attributeOpts = attributes.map((a) => ({
    id: a.id,
    label: a.nameEn,
    kind: a.kind,
    values: a.values.map((v) => ({ id: v.id, label: v.valueEn })),
  }));

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
        preorderEnabled: product.preorderEnabled,
        maleSupport: product.maleSupport,
        purchaseUrl: product.purchaseUrl ?? '',
        originCountry: product.originCountry,
        purchaseCost: product.purchaseCostMinor != null ? product.purchaseCostMinor / 100 : undefined,
        brandId: product.brandId,
        productType: product.productType,
        basePriceEgp: piastresToEgp(product.basePricePiastres),
        weightG: product.weightG,
        servingsPerUnit: product.servingsPerUnit,
        dailyDosage: product.dailyDosage,
        dailyDosageMax: product.dailyDosageMax,
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-xl font-semibold">
          {productId ? tb('Edit product', 'تعديل منتج') : tb('New product', 'منتج جديد')}
        </h1>
        {product?.status === 'PUBLISHED' && product.slugEn && (
          <Link href={`/products/${product.slugEn}`} target="_blank" className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface">
            ↗ {tb('View on site', 'عرض في المتجر')}
          </Link>
        )}
      </div>
      {lotMsg === 'saved' && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Stock saved.', 'تم حفظ المخزون.')}</p>}
      {lotMsg === 'error' && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Could not save the lot.', 'تعذّر حفظ الدفعة.')}</p>}

      <ProductForm
        locale={locale}
        defaults={defaults}
        brands={brands.map((b) => ({ value: b.id, label: b.nameEn }))}
        categories={categories.map((c) => ({ value: c.id, label: c.nameEn, parentId: c.parentId }))}
        tags={tags.map((t) => ({ value: t.id, label: t.nameEn }))}
        attributes={attributeOpts}
      />

      {product && (
        <ProductStock
          locale={locale}
          productId={product.id}
          basePricePiastres={product.basePricePiastres}
          lots={lots}
          locations={locations.map((l) => ({ value: l.id, label: l.name }))}
          canEdit={canStock}
        />
      )}

      {product && <ChangeHistory entityType="Product" entityId={product.id} locale={locale} />}
    </div>
  );
}
