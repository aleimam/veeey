import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listProducts, countProducts, inventoryColumnsFor } from '@/lib/catalog-service';
import { listBrands, listCategories } from '@/lib/taxonomy-service';
import { marginOf, type InvSummary } from '@/lib/inventory-columns';
import { formatEGP } from '@/lib/format';
import { StatusBadge } from '@/components/admin/ui';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { InUseNotice } from '@/components/admin/row-actions';
import { deleteEntityAction } from '@/server/admin-actions';
import { bulkProductsAction } from '@/server/bulk-actions';
import { ExportBar, exportQs } from '@/components/admin/export-bar';
import { FilterBar } from '@/components/admin/filter-bar';
import { SortableTh } from '@/components/admin/sortable-th';
import { ListPagination } from '@/components/admin/list-pagination';
import { BulkBar, type BulkOp } from '@/components/admin/bulk-bar';
import { PriceTools } from '@/components/admin/price-tools';
import { parseListParams, listQs, type SP } from '@/lib/admin-list';
import { pick } from '@/lib/admin-i18n';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const SORTABLE = ['name', 'sku', 'price', 'status', 'updated', 'created'] as const;

export default async function ProductsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);

  const q = one(sp.q);
  const kind = one(sp.kind);
  const status = one(sp.status);
  const brand = one(sp.brand);
  const flag = one(sp.flag);
  const origin = one(sp.origin);
  const tag = one(sp.tag);
  const category = one(sp.category);
  // Owner 2026-07-22: newest-ADDED first by default (was updatedAt, which the
  // 10-min net-sync churns — every synced product looked "recent").
  const { sort, dir, page, perPage } = parseListParams(sp, { sortable: SORTABLE, defaultSort: 'created' });
  const filters = { search: q, status, kind, brand, flag, origin, tag, category };

  const [products, total, allCount, brands, categories] = await Promise.all([
    listProducts({ ...filters, sort, dir, page, perPage }),
    countProducts(filters),
    countProducts({}),
    listBrands(),
    listCategories(),
  ]);
  const brandOptions = brands.map((b) => ({ value: b.id, label: b.nameEn }));

  // V7 audit C13: opt-in stock & margin columns (?cols=inv, carried by listQs
  // through sort/pagination). Opt-in because they cost a lots query per page
  // and most catalog work doesn't need them.
  const showInv = one(sp.cols) === 'inv';
  const inv: Map<string, InvSummary> = showInv ? await inventoryColumnsFor(products.map((p) => p.id)) : new Map();

  const basePath = `/${locale}/admin/products`;
  const back = `${basePath}${listQs(sp, { done: undefined, skip: undefined, error: undefined })}`;
  const done = one(sp.done);

  const ops: BulkOp[] = [
    { value: 'status', label: tb('Set status', 'تعيين الحالة'), values: [
      { value: 'PUBLISHED', label: tb('Published', 'منشور') },
      { value: 'PRIVATE', label: tb('Private', 'خاص') },
      { value: 'DRAFT', label: tb('Draft', 'مسودة') },
      { value: 'ARCHIVED', label: tb('Archived', 'مؤرشف') },
    ] },
    { value: 'kind', label: tb('Set kind', 'تعيين النوع'), values: [
      { value: 'SUPPLEMENT', label: tb('Supplement', 'مكمل غذائي') },
      { value: 'DEVICE', label: tb('Device', 'جهاز') },
      { value: 'INJECTION', label: tb('Injection', 'حقن') },
    ] },
    { value: 'brand', label: tb('Set brand', 'تعيين العلامة'), values: [{ value: '__none__', label: tb('— None —', '— بدون —') }, ...brandOptions] },
    { value: 'category', label: tb('Add category', 'إضافة فئة'), values: categories.map((c) => ({ value: c.id, label: c.nameEn })) },
    { value: 'price_percent', label: tb('Price: adjust by %', 'السعر: تعديل بنسبة ٪'), input: { placeholder: tb('e.g. 10 or -5', 'مثل 10 أو -5') } },
    { value: 'price_fixed', label: tb('Price: adjust by ± EGP', 'السعر: تعديل بقيمة ± جنيه'), input: { placeholder: tb('e.g. 50 or -20', 'مثل 50 أو -20') } },
    { value: 'price_set', label: tb('Price: set EGP', 'السعر: تعيين بالجنيه'), input: { placeholder: tb('e.g. 750', 'مثل 750') } },
    { value: 'origin', label: tb('Set origin country', 'تعيين بلد المنشأ'), values: [
      { value: 'USA', label: 'USA' }, { value: 'UK', label: 'UK' }, { value: 'EU', label: 'EU' },
      { value: '__none__', label: tb('— None —', '— بدون —') },
    ] },
    { value: 'purchase_price', label: tb('Set purchase price (origin currency)', 'تعيين سعر الشراء (بعملة المنشأ)'), input: { placeholder: tb('e.g. 12.99', 'مثل 12.99') } },
    { value: 'delete', label: tb('Delete', 'حذف'), danger: true, typedConfirm: true },
  ];

  return (
    <div className="p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold">{tb('Products', 'المنتجات')} ({total})</h1>
        <div className="flex items-center gap-2">
          <ExportBar entity="products" locale={locale} query={exportQs(sp)} />
          <Link href="/admin/products/edit" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">{tb('New product', 'منتج جديد')}</Link>
        </div>
      </header>

      <InUseNotice show={one(sp.error) === 'in_use'} />
      {done != null && (
        <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
          {tb(`Updated ${done} product(s).`, `تم تحديث ${done} منتج.`)}{Number(one(sp.skip)) > 0 ? tb(` ${one(sp.skip)} skipped (in use / not allowed).`, ` تم تخطّي ${one(sp.skip)} (قيد الاستخدام / غير مسموح).`) : ''}
        </p>
      )}
      {one(sp.error) === 'bulk' && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Bulk action failed.', 'فشل الإجراء الجماعي.')}</p>}

      <FilterBar
        locale={locale}
        path="products"
        values={{ q, kind, status, brand, flag, origin }}
        // tag/category arrive via links, not filter fields — without carrying
        // them, submitting this form silently drops them (V7 C18, the same
        // FilterBar bug V6 fixed on Orders).
        keep={{ tag, category }}
        fields={[
          { name: 'q', label: tb('Search', 'بحث'), type: 'text', placeholder: tb('Name / SKU', 'الاسم / رمز المنتج') },
          { name: 'kind', label: tb('Kind', 'النوع'), type: 'select', options: [
            { value: 'SUPPLEMENT', label: tb('Supplement', 'مكمل غذائي') },
            { value: 'DEVICE', label: tb('Device', 'جهاز') },
            { value: 'INJECTION', label: tb('Injection', 'حقن') },
          ] },
          { name: 'status', label: tb('Status', 'الحالة'), type: 'select', options: [
            { value: 'PUBLISHED', label: tb('Published', 'منشور') },
            { value: 'PRIVATE', label: tb('Private', 'خاص') },
            { value: 'DRAFT', label: tb('Draft', 'مسودة') },
            { value: 'ARCHIVED', label: tb('Archived', 'مؤرشف') },
          ] },
          // combo, not select: ~650 brands (V7 audit C2) — type to filter.
          { name: 'brand', label: tb('Brand', 'العلامة التجارية'), type: 'combo', options: brandOptions, placeholder: tb('Search brands…', 'ابحث في العلامات…') },
          { name: 'flag', label: tb('Data filter', 'تصفية البيانات'), type: 'select', options: [
            { value: 'missing_brand', label: tb('Missing brand', 'بدون علامة تجارية') },
            { value: 'missing_image', label: tb('Missing image', 'بدون صورة') },
            { value: 'missing_category', label: tb('Missing category', 'بدون فئة') },
            { value: 'price_zero', label: tb('Price = 0', 'السعر = 0') },
            { value: 'missing_purchase_price', label: tb('Missing purchase price', 'بدون سعر شراء') },
            { value: 'missing_arabic', label: tb('Missing Arabic (name/desc)', 'بدون ترجمة عربية') },
            { value: 'missing_purchase_url', label: tb('Missing purchase URL', 'بدون رابط شراء') },
            { value: 'out_of_stock', label: tb('Out of stock', 'غير متوفر') },
            { value: 'low_stock', label: tb('Low stock', 'مخزون منخفض') },
          ] },
          { name: 'origin', label: tb('Origin', 'المنشأ'), type: 'select', options: [
            { value: 'USA', label: 'USA' }, { value: 'UK', label: 'UK' }, { value: 'EU', label: 'EU' },
            { value: 'none', label: tb('No origin set', 'بدون منشأ') },
          ] },
        ]}
      />

      <PriceTools locale={locale} back={back} total={allCount} />

      <BulkBar
        formId="bulk-products"
        action={bulkProductsAction}
        locale={locale}
        back={back}
        ops={ops}
        exportHref="/api/admin/export/products"
        labels={{ selectAllPage: tb('Select page', 'تحديد الصفحة'), selected: tb('selected', 'محدد'), apply: tb('Apply', 'تطبيق'), exportSel: tb('Export selected', 'تصدير المحدد'), confirmDanger: tb('Delete the selected products? In-use products are skipped.', 'حذف المنتجات المحددة؟ يتم تخطّي المستخدمة.'), needValue: tb('Choose a value first.', 'اختر قيمة أولًا.') }}
      />

      <div className="mb-2 text-end">
        <a href={`${basePath}${listQs(sp, { cols: showInv ? undefined : 'inv' })}`} className="text-sm text-primary hover:underline">
          {showInv ? tb('Hide stock & margin', 'إخفاء المخزون والهامش') : tb('Show stock & margin', 'عرض المخزون والهامش')}
        </a>
      </div>

      {/* V7 audit C15: the table scrolls INSIDE this wrapper so the sticky
          thead engages (sticky can't work vertically in a plain overflow-x
          container — it becomes a both-axis scroll container with no height).
          Bonus: the BulkBar sits above the scroll region, so bulk actions stay
          on screen however deep the rows go. */}
      <div className="max-h-[72vh] overflow-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-surface text-start text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-8 p-3" />
              <SortableTh col="name" label={tb('Name', 'الاسم')} sort={sort} dir={dir} sp={sp} basePath={basePath} />
              <SortableTh col="sku" label={tb('SKU', 'رمز المنتج (SKU)')} sort={sort} dir={dir} sp={sp} basePath={basePath} />
              <th className="p-3 text-start">{tb('Brand', 'العلامة التجارية')}</th>
              <SortableTh col="price" label={tb('Price', 'السعر')} sort={sort} dir={dir} sp={sp} basePath={basePath} />
              {showInv && <th className="p-3 text-end">{tb('Stock', 'المخزون')}</th>}
              {showInv && (
                // Not sortable: both are lot aggregates, and sorting them
                // server-side needs a raw-SQL orderBy — out of polish scope.
                <th className="p-3 text-end" title={tb('Base price minus weighted-average lot cost. Storefront sells per-lot prices, so treat as indicative.', 'السعر الأساسي ناقص متوسط تكلفة الدُفعات المرجّح. المتجر يبيع بسعر لكل دفعة، فالرقم استرشادي.')}>
                  {tb('Margin', 'الهامش')}
                </th>
              )}
              <SortableTh col="status" label={tb('Status', 'الحالة')} sort={sort} dir={dir} sp={sp} basePath={basePath} />
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const s = inv.get(p.id);
              const m = s ? marginOf(Number(p.basePricePiastres), s.avgCostPiastres) : null;
              return (
              <tr key={p.id} className="border-t border-border">
                <td className="p-3"><input type="checkbox" name="ids" value={p.id} form="bulk-products" className="size-4" aria-label={p.nameEn} /></td>
                <td className="p-3 font-medium">{p.nameEn}</td>
                <td className="p-3 text-muted-foreground">{p.sku}</td>
                <td className="p-3 text-muted-foreground">{p.brand?.nameEn ?? '—'}</td>
                <td className="p-3">{formatEGP(Number(p.basePricePiastres))}</td>
                {showInv && <td className={`p-3 text-end tabular-nums ${(s?.available ?? 0) === 0 ? 'text-muted-foreground' : ''}`}>{s?.available ?? 0}</td>}
                {showInv && (
                  <td className={`p-3 text-end tabular-nums ${m && m.piastres < 0 ? 'text-destructive' : ''}`}>
                    {m ? `${formatEGP(m.piastres)} (${m.pct}%)` : '—'}
                  </td>
                )}
                <td className="p-3"><StatusBadge status={p.status} /></td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/admin/products/edit/${p.id}`} className="text-primary hover:underline">{tb('Edit', 'تعديل')}</Link>
                    <form action={deleteEntityAction}>
                      <input type="hidden" name="entity" value="product" />
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="path" value="products" />
                      <input type="hidden" name="locale" value={locale} />
                      {/* V7 audit C8: this fired on a single click. The server
                          still refuses in-use products; the dialog covers the
                          fresh ones that would vanish without a question. */}
                      <ConfirmButton
                        warn={tb(
                          `Delete "${p.nameEn}" permanently? Products with orders or stock are refused.`,
                          `حذف "${p.nameEn}" نهائيًا؟ المنتجات المرتبطة بطلبات أو مخزون يُرفض حذفها.`,
                        )}
                        className="text-destructive hover:underline"
                      >
                        {tb('Delete', 'حذف')}
                      </ConfirmButton>
                    </form>
                  </div>
                </td>
              </tr>
              );
            })}
            {products.length === 0 && (
              <tr><td colSpan={showInv ? 9 : 7} className="p-6 text-center text-muted-foreground">{tb('No products match.', 'لا توجد منتجات مطابقة.')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <ListPagination page={page} perPage={perPage} total={total} sp={sp} basePath={basePath} locale={locale} perPageOptions={[25, 50, 100, 200]} />
    </div>
  );
}
