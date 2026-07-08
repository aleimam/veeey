import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth-guards';
import { hasPermission } from '@/lib/rbac';
import { pick } from '@/lib/admin-i18n';
import { formatEGP } from '@/lib/format';
import { goLiveCounts, listGoLiveProducts, countGoLiveProducts } from '@/lib/go-live-service';
import { getMediaLocalizeStatus, countRemoteMedia } from '@/lib/media-localize-service';
import { quickAddStockAction, publishReadyAction } from '@/server/go-live-actions';
import { StockImportForm } from '@/components/admin/stock-import-form';
import { MediaLocalizeButton } from '@/components/admin/media-localize-button';
import { GoLiveBulkBar, PublishAllReady } from '@/components/admin/go-live-bulk';
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
  const [counts, rows, total, remoteMedia, mediaJob] = await Promise.all([
    goLiveCounts(),
    listGoLiveProducts({ q, only, skip: (page - 1) * perPage, take: perPage }),
    countGoLiveProducts({ q, only }),
    countRemoteMedia(),
    getMediaLocalizeStatus(),
  ]);
  // Reconciliation: Not live = Ready + Not-ready. "No price"/"No image" overlap
  // (a product can miss both), so they don't sum to Not-ready — the tooltips say so.
  const notReady = counts.preLive - counts.ready;

  const basePath = `/${locale}/admin/go-live`;
  const card = 'rounded-xl border border-border bg-card p-4';
  const published = one(sp.published);
  const filterHref = (key: string) => `${basePath}${listQs(sp, { only: key || undefined, page: undefined, published: undefined, added: undefined, notready: undefined, error: undefined })}`;

  const FILTER_TITLES: Record<string, [string, string]> = {
    '': ['Not-live products', 'منتجات غير منشورة'],
    ready: ['Ready to publish (unpublished)', 'جاهز للنشر (غير منشور)'],
    published: ['Published products', 'المنتجات المنشورة'],
    stock: ['Not-live without stock', 'غير منشور بدون مخزون'],
    price: ['Not-live without price', 'غير منشور بدون سعر'],
    image: ['Not-live without image', 'غير منشور بدون صورة'],
  };
  const heading = FILTER_TITLES[only ?? ''] ?? FILTER_TITLES[''];

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 font-heading text-xl font-semibold text-foreground">{tb('Catalog go-live', 'إطلاق الكتالوج')}</h1>
      <p className="mb-4 max-w-3xl text-sm text-muted-foreground">{tb('Get imported products sale-ready. A product is ready to publish once it has a price and at least one image — publishing only flips ready products. Stock is optional: a published product with no stock stays hidden from the storefront until you add stock or turn on its pre-order switch.', 'جهّز المنتجات المستوردة للبيع. يصبح المنتج جاهزًا للنشر بمجرد أن يكون لديه سعر وصورة واحدة على الأقل — والنشر يفعّل المنتجات الجاهزة فقط. المخزون اختياري: المنتج المنشور بدون مخزون يظل مخفيًا في المتجر حتى تضيف مخزونًا أو تفعّل خيار الطلب المسبق.')}</p>

      {published != null && <div className="mb-4 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{tb(`Published ${published} product(s).`, `تم نشر ${published} منتج.`)}</div>}
      {one(sp.added) && <div className="mb-4 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Stock added.', 'تمت إضافة المخزون.')}{one(sp.notready) && <span className="ms-2 text-amber-700">{tb('Not published — the product still needs a price and an image.', 'لم يُنشر — المنتج ما زال يحتاج سعرًا وصورة.')}</span>}</div>}
      {one(sp.error) && <div className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Action failed — nothing was changed. Check the values and try again.', 'فشل الإجراء — لم يتغير شيء. راجع القيم وحاول مجددًا.')}</div>}

      {/* Summary cards — every card filters the table; tooltips explain the math. */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { k: 'preLive', label: tb('Not live', 'غير منشور'), val: counts.preLive, only: '', tip: tb(`All Draft/Private products. = Ready (${counts.ready}) + Not ready (${notReady}).`, `كل المنتجات غير المنشورة. = الجاهز (${counts.ready}) + غير الجاهز (${notReady}).`) },
          { k: 'ready', label: tb('Ready', 'جاهز'), val: counts.ready, only: 'ready', tone: 'text-primary', tip: tb('Not-live products with a price AND at least one image — publishable now. This is the main working view.', 'منتجات غير منشورة لديها سعر وصورة — قابلة للنشر الآن. هذه هي شاشة العمل الرئيسية.') },
          { k: 'missingStock', label: tb('No stock', 'بدون مخزون'), val: counts.missingStock, only: 'stock', tip: tb('Not-live products without sellable stock. Informational — stock does NOT block publishing, so this overlaps the other cards.', 'منتجات غير منشورة بدون مخزون. للعلم فقط — المخزون لا يمنع النشر، لذا تتقاطع مع البطاقات الأخرى.') },
          { k: 'missingPrice', label: tb('No price', 'بدون سعر'), val: counts.missingPrice, only: 'price', tip: tb(`Not-live products with price = 0. A product missing BOTH price and image is counted here AND in "No image" — so these two cards can sum to more than Not ready (${notReady}).`, `منتجات غير منشورة سعرها 0. المنتج الذي ينقصه السعر والصورة معًا يُحسب هنا وفي «بدون صورة» — لذا قد يتجاوز مجموعهما «غير الجاهز» (${notReady}).`) },
          { k: 'missingImage', label: tb('No image', 'بدون صورة'), val: counts.missingImage, only: 'image', tip: tb(`Not-live products with no image. Overlaps "No price" when both are missing; Not live − Ready = ${notReady} products are missing price and/or image (each counted once).`, `منتجات غير منشورة بدون صورة. تتقاطع مع «بدون سعر» عند غياب الاثنين؛ غير المنشور − الجاهز = ${notReady} منتجًا ينقصه السعر و/أو الصورة (يُحسب مرة واحدة).`) },
          { k: 'published', label: tb('Published', 'منشور'), val: counts.published, only: 'published', tone: 'text-primary', tip: tb('Products already live on the storefront (out-of-stock ones stay hidden until stocked or flagged pre-order).', 'منتجات منشورة بالفعل (غير المتوفرة تبقى مخفية حتى إضافة مخزون أو تفعيل الطلب المسبق).') },
        ].map((c) => (
          <a key={c.k} href={c.only ? filterHref(c.only) : basePath} title={c.tip} className={`${card} block transition-colors hover:border-primary/40 ${only === c.only || (!only && c.only === '') ? 'border-primary/60' : ''}`}>
            <div className={`text-2xl font-semibold ${c.tone ?? 'text-foreground'}`}>{c.val}</div>
            <div className="text-xs text-muted-foreground">{c.label}</div>
          </a>
        ))}
      </div>

      {/* minmax(0,1fr) lets the table column shrink so the import panel is never
          pushed off-screen; below lg the panel stacks under the table. */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">{tb(heading[0], heading[1])} ({total})</h2>
            <PublishAllReady locale={locale} readyCount={counts.ready} />
          </div>
          <form method="get" className="mb-3 flex gap-2">
            {only && <input type="hidden" name="only" value={only} />}
            <input name="q" defaultValue={q ?? ''} placeholder={tb('Search name or SKU…', 'ابحث بالاسم أو SKU…')} className={`${inputCls} max-w-xs`} />
            <SubmitButton>{tb('Search', 'بحث')}</SubmitButton>
            {(q || only) && <a href={basePath} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface">{tb('Clear', 'مسح')}</a>}
          </form>

          {only !== 'published' && <GoLiveBulkBar locale={locale} />}

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface text-xs uppercase text-muted-foreground">
                <tr>
                  {only !== 'published' && <th className="w-8 p-3" />}
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
                    {only !== 'published' && (
                      <td className="p-3">
                        {p.status !== 'PUBLISHED' && <input type="checkbox" name="ids" value={p.id} form="golive-bulk" className="size-4" aria-label={p.nameEn} />}
                      </td>
                    )}
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
                          {p.status !== 'PUBLISHED' && (
                            <button name="andPublish" value="1" title={tb('Add the stock, then publish (only if ready).', 'أضف المخزون ثم انشر (إذا كان جاهزًا).')} className="rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground">
                              {tb('Add + Publish', 'إضافة + نشر')}
                            </button>
                          )}
                        </form>
                      )}
                    </td>
                    <td className="p-3 text-end">
                      {p.status === 'PUBLISHED' ? (
                        <span className="text-xs text-primary">✓ {tb('Live', 'منشور')}</span>
                      ) : p.ready ? (
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
                {rows.length === 0 && <tr><td colSpan={only === 'published' ? 6 : 7} className="p-6 text-center text-muted-foreground">{tb('Nothing here — all caught up.', 'لا شيء هنا — كل شيء جاهز.')}</td></tr>}
              </tbody>
            </table>
          </div>
          <ListPagination page={page} perPage={perPage} total={total} sp={sp} basePath={basePath} locale={locale} perPageOptions={[25, 50, 100, 200]} />
        </section>

        {/* Bulk stock import — stacks below the table on narrow screens. */}
        <aside className={`${card} h-fit min-w-0`}>
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

          {/* Media durability — imported catalog images still live on the old
              site's CDN; localize them so the storefront never depends on it. */}
          <div className="mt-5 border-t border-border pt-4">
            <h2 className="mb-2 text-base font-semibold text-foreground">{tb('Media durability', 'حماية الصور')}</h2>
            <p className="mb-3 text-xs text-muted-foreground">{tb('Imported product/brand/category images still load from the old site’s CDN. Localizing downloads each one into Veeey’s own storage (as WebP) so they keep working even if the old CDN account expires. Dead links are pruned so those products appear in the "No image" filter.', 'صور المنتجات/العلامات/الفئات المستوردة ما زالت تُحمَّل من CDN الموقع القديم. التوطين ينزّل كل صورة إلى تخزين Veeey الخاص (بصيغة WebP) لتظل تعمل حتى لو انتهى حساب الـ CDN القديم. الروابط الميتة تُحذف لتظهر منتجاتها في فلتر «بدون صورة».')}</p>
            {one(sp.mjob) === 'started' && <p className="mb-3 rounded-md bg-primary/10 px-3 py-2 text-xs text-primary">{tb('Localization job started — it runs in the background. Refresh to see progress.', 'بدأت مهمة التوطين — تعمل في الخلفية. حدّث الصفحة لمتابعة التقدم.')}</p>}
            {one(sp.mjob) === 'offline' && <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{tb('Could not start the job — the background worker is not reachable.', 'تعذّر بدء المهمة — عامل الخلفية غير متاح.')}</p>}
            {mediaJob?.state === 'running' && <p className="mb-3 rounded-md bg-primary/10 px-3 py-2 text-xs text-primary">{tb(`Localizing… ${mediaJob.done}/${mediaJob.total} done${mediaJob.failed ? `, ${mediaJob.failed} dead link(s) pruned` : ''}.`, `جارٍ التوطين… ${mediaJob.done}/${mediaJob.total}${mediaJob.failed ? `، حُذف ${mediaJob.failed} رابط ميت` : ''}.`)}</p>}
            {mediaJob?.state === 'done' && remoteMedia > 0 && <p className="mb-3 rounded-md bg-primary/10 px-3 py-2 text-xs text-primary">{tb(`Last run finished (${mediaJob.done}/${mediaJob.total} localized). ${remoteMedia} remote image(s) remain — run again to catch them.`, `انتهى آخر تشغيل (${mediaJob.done}/${mediaJob.total}). تبقّى ${remoteMedia} صورة خارجية — شغّل المهمة مجددًا.`)}</p>}
            <MediaLocalizeButton locale={locale} remote={remoteMedia} />
          </div>
        </aside>
      </div>
    </div>
  );
}
