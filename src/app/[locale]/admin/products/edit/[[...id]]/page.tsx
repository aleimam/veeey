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
import { setAlwaysNeededAction } from '@/server/request-actions';
import { inputCls } from '@/components/admin/ui';
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
  // Always-Needed is a purchasing flag — set by admins (catalog.write) AND sales
  // (inventory.manage), so its own control shows for either (Requests epic C).
  const canAlwaysNeeded = canStock || hasPermission(user?.permissions ?? [], 'catalog.write');
  const lotMsg = Array.isArray(sp.lot) ? sp.lot[0] : sp.lot;
  const anSaved = (Array.isArray(sp.an) ? sp.an[0] : sp.an) === '1';

  const attributeOpts = attributes.map((a) => ({
    id: a.id,
    label: a.nameEn,
    kinds: a.kinds.length ? a.kinds : [a.kind],
    inputType: a.inputType,
    required: a.isRequired,
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
        reorderPoint: product.reorderPoint,
        servingsPerUnit: product.servingsPerUnit,
        dailyDosage: product.dailyDosage,
        dailyDosageMax: product.dailyDosageMax,
        shortDescEn: product.shortDescEn ?? '',
        shortDescAr: product.shortDescAr ?? '',
        longDescEn: product.longDescEn ?? '',
        longDescAr: product.longDescAr ?? '',
        seo: {
          metaTitleEn: product.metaTitleEn ?? '', metaTitleAr: product.metaTitleAr ?? '',
          metaDescEn: product.metaDescEn ?? '', metaDescAr: product.metaDescAr ?? '',
          aiSummaryEn: product.aiSummaryEn ?? '', aiSummaryAr: product.aiSummaryAr ?? '',
          focusKeywordEn: product.focusKeywordEn ?? '', focusKeywordAr: product.focusKeywordAr ?? '',
          secondaryKeywordsEn: product.secondaryKeywordsEn ?? '', secondaryKeywordsAr: product.secondaryKeywordsAr ?? '',
          ogTitleEn: product.ogTitleEn ?? '', ogTitleAr: product.ogTitleAr ?? '',
          ogDescEn: product.ogDescEn ?? '', ogDescAr: product.ogDescAr ?? '',
          ogImage: product.ogImage ?? '',
          canonicalUrl: product.canonicalUrl ?? '',
          robotsIndex: product.robotsIndex, robotsFollow: product.robotsFollow,
          schemaOverrides: product.schemaOverridesJson ? JSON.stringify(product.schemaOverridesJson, null, 2) : '',
        },
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
        schemaInfo={product ? {
          name: product.nameEn,
          brand: product.brand?.nameEn ?? '',
          priceEgp: piastresToEgp(product.basePricePiastres),
          inStock: lots.some((l) => l.status === 'LIVE' && l.qtyOnHand - l.qtyReserved > 0),
          ratingAvg: product.ratingAvg,
          ratingCount: product.ratingCount,
          image: product.images[0]?.url ?? '',
        } : undefined}
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

      {product && canAlwaysNeeded && (
        <section className="mt-6 rounded-lg border border-border p-4">
          <h2 className="mb-1 font-heading text-lg font-semibold">{tb('Always needed', 'مطلوب دائمًا')}</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            {tb('Keep a continuous purchasing request open for this product — a target quantity refilled every month.', 'أبقِ طلب شراء مستمرًا مفتوحًا لهذا المنتج — كمية مستهدفة تُجدَّد كل شهر.')}
          </p>
          {anSaved && <p className="mb-3 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Saved.', 'تم الحفظ.')}</p>}
          <form action={setAlwaysNeededAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="productId" value={product.id} />
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="alwaysNeeded" defaultChecked={product.alwaysNeeded} className="size-4" />
              {tb('Always needed', 'مطلوب دائمًا')}
            </label>
            <label className="text-sm font-medium">
              {tb('Target quantity (X)', 'الكمية المستهدفة (X)')}
              <input name="alwaysNeededQty" type="number" min={1} defaultValue={product.alwaysNeededQty ?? ''} placeholder="0" className={`${inputCls} w-32`} />
            </label>
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">{tb('Save', 'حفظ')}</button>
          </form>
        </section>
      )}

      {product && <ChangeHistory entityType="Product" entityId={product.id} locale={locale} />}
    </div>
  );
}
