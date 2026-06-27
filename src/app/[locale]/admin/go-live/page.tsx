import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth-guards';
import { hasPermission } from '@/lib/rbac';
import { pick } from '@/lib/admin-i18n';
import { formatEGP } from '@/lib/format';
import { goLiveCounts, listGoLiveProducts, countGoLiveProducts } from '@/lib/go-live-service';
import { quickAddStockAction, publishReadyAction } from '@/server/go-live-actions';
import { StockImportForm } from '@/components/admin/stock-import-form';
import { ListPagination } from '@/components/admin/list-pagination';
import { parseListParams, listQs, type SP } from '@/lib/admin-list';
import { inputCls, SubmitButton } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function GoLivePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });
  if (!user) return null;
  if (!hasPermission(user.permissions, 'catalog.write')) redirect({ href: '/admin', locale });
  const canStock = hasPermission(user.permissions, 'inventory.manage');

  const q = one(sp.q);
  const only = one(sp.only);
  const { page, perPage } = parseListParams(sp, { sortable: [], defaultSort: '' });
  const [counts, rows, total] = await Promise.all([
    goLiveCounts(),
    listGoLiveProducts({ q, only, skip: (page - 1) * perPage, take: perPage }),
    countGoLiveProducts({ q, only }),
  ]);

  const basePath = `/${locale}/admin/go-live`;
  const card = 'rounded-xl border border-border bg-card p-4';
  const published = one(sp.published);
  const filterHref = (key: string) => `${basePath}${listQs(sp, { only: key || undefined, page: undefined })}`;

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 font-heading text-xl font-semibold text-foreground">{tb('Catalog go-live', 'إطلاق الكتالوج')}</h1>
      <p className="mb-4 max-w-3xl text-sm text-muted-foreground">{tb('Get imported products sale-ready. A product is ready to publish once it has a price and at least one image — publishing only flips ready products. Stock is optional: a published product with no stock stays hidden from the storefront until you add stock or turn on its pre-order switch.', 'جهّز المنتجات المستوردة للبيع. يصبح المنتج جاهزًا للنشر بمجرد أن يكون لديه سعر وصورة واحدة على الأقل — والنشر يفعّل المنتجات الجاهزة فقط. المخزون اختياري: المنتج المنشور بدون مخزون يظل مخفيًا في المتجر حتى تضيف مخزونًا أو تفعّل خيار الطلب المسبق.')}</p>

      {published != null && <div className="mb-4 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{tb(`Published ${published} product(s).`, `تم نشر ${published} منتج.`)}</div>}
      {one(sp.added) && <div className="mb-4 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Stock added.', 'تمت إضافة المخزون.')}</div>}
      {one(sp.error) && <div className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Action failed.', 'فشل الإجراء.')}</div>}

      {/* Summary */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { k: 'preLive', label: tb('Not live', 'غير منشور'), val: counts.preLive, only: '' },
          { k: 'ready', label: tb('Ready', 'جاهز'), val: counts.ready, only: '', tone: 'text-primary' },
          { k: 'missingStock', label: tb('No stock', 'بدون مخزون'), val: counts.missingStock, only: 'stock' },
          { k: 'missingPrice', label: tb('No price', 'بدون سعر'), val: counts.missingPrice, only: 'price' },
          { k: 'missingImage', label: tb('No image', 'بدون صورة'), val: counts.missingImage, only: 'image' },
          { k: 'published', label: tb('Published', 'منشور'), val: counts.published, only: '', tone: 'text-primary' },
        ].map((c) => (
          <a key={c.k} href={c.only ? filterHref(c.only) : basePath} className={`${card} block transition-colors hover:border-primary/40`}>
            <div className={`text-2xl font-semibold ${c.tone ?? 'text-foreground'}`}>{c.val}</div>
            <div className="text-xs text-muted-foreground">{c.label}</div>
          </a>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Products needing go-live */}
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">{tb('Not-live products', 'منتجات غير منشورة')} ({total}){only ? ` · ${tb('filtered', 'مُصفّى')}` : ''}</h2>
            <form action={publishReadyAction}>
              <input type="hidden" name="locale" value={locale} />
              <button className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">{tb('Publish all ready', 'نشر كل الجاهز')}</button>
            </form>
          </div>
          <form method="get" className="mb-3 flex gap-2">
            {only && <input type="hidden" name="only" value={only} />}
            <input name="q" defaultValue={q ?? ''} placeholder={tb('Search name or SKU…', 'ابحث بالاسم أو SKU…')} className={`${inputCls} max-w-xs`} />
            <SubmitButton>{tb('Search', 'بحث')}</SubmitButton>
            {(q || only) && <a href={basePath} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface">{tb('Clear', 'مسح')}</a>}
          </form>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3 text-start">{tb('Product', 'المنتج')}</th>
                  <th className="p-3 text-start">{tb('Price', 'السعر')}</th>
                  <th className="p-3 text-center">{tb('Stock', 'مخزون')}</th>
                  <th className="p-3 text-center">{tb('Image', 'صورة')}</th>
                  <th className="p-3 text-start">{canStock ? tb('Add stock', 'إضافة مخزون') : ''}</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-t border-border align-top">
                    <td className="p-3"><div className="font-medium text-foreground">{p.nameEn}</div><div className="font-mono text-xs text-muted-foreground">{p.sku}</div></td>
                    <td className="p-3">{p.pricePiastres > 0n ? formatEGP(Number(p.pricePiastres)) : <span className="text-destructive">{tb('—', '—')}</span>}</td>
                    <td className="p-3 text-center">{p.inStock ? <span className="text-primary">✓</span> : <span className="text-destructive">✕</span>}</td>
                    <td className="p-3 text-center">{p.images > 0 ? <span className="text-primary">✓</span> : <span className="text-destructive">✕</span>}</td>
                    <td className="p-3">
                      {canStock && (
                        <form action={quickAddStockAction} className="flex flex-wrap items-center gap-1.5">
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="productId" value={p.id} />
                          <input name="qty" type="number" min="1" placeholder={tb('Qty', 'كمية')} required className={`${inputCls} w-20`} />
                          <input name="expiry" type="date" title={tb('Expiry (blank = none)', 'الصلاحية (فارغ = بدون)')} className={`${inputCls} w-36`} />
                          <button className="rounded-md border border-border px-2 py-1.5 text-xs hover:bg-surface">{tb('Add', 'إضافة')}</button>
                        </form>
                      )}
                    </td>
                    <td className="p-3 text-end">
                      {p.ready ? (
                        <form action={publishReadyAction}>
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="ids" value={p.id} />
                          <button className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">{tb('Publish', 'نشر')}</button>
                        </form>
                      ) : (
                        <span className="text-xs text-muted-foreground">{tb('Not ready', 'غير جاهز')}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">{tb('Nothing here — all caught up.', 'لا شيء هنا — كل شيء جاهز.')}</td></tr>}
              </tbody>
            </table>
          </div>
          <ListPagination page={page} perPage={perPage} total={total} sp={sp} basePath={basePath} locale={locale} />
        </section>

        {/* Bulk stock import */}
        <aside className={`${card} h-fit`}>
          <h2 className="mb-2 text-base font-semibold text-foreground">{tb('Bulk stock import', 'استيراد المخزون بالجملة')}</h2>
          {canStock ? (
            <>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- API file download, not a page nav */}
              <a href="/api/admin/go-live/stock-template" className="mb-3 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface">
                ⬇ {tb('Download CSV template', 'تنزيل قالب CSV')}
              </a>
              <p className="mb-3 text-xs text-muted-foreground">{tb('The template lists every product that still needs stock (SKU + name). Fill in qty + expiry and upload it below.', 'يحتوي القالب على كل منتج ما زال يحتاج مخزونًا (SKU + الاسم). أدخل الكمية والصلاحية وارفعه أدناه.')}</p>
              <StockImportForm locale={locale} />
            </>
          ) : <p className="text-sm text-muted-foreground">{tb('Requires inventory permission.', 'يتطلب صلاحية المخزون.')}</p>}
        </aside>
      </div>
    </div>
  );
}
