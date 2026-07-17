import { setRequestLocale } from 'next-intl/server';
import { redirect, Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth-guards';
import { hasPermission } from '@/lib/rbac';
import { pick } from '@/lib/admin-i18n';
import { getReorderView, type ReorderTabKey } from '@/lib/inventory-reorder-service';
import { requestToBuyAction, ignoreAction, unignoreAction, bulkRequestAction, bulkIgnoreAction } from '@/server/inventory-reorder-actions';
import { ReorderBulkBar } from '@/components/admin/reorder-bulk-bar';
import { ListPagination } from '@/components/admin/list-pagination';
import { parseListParams, listQs, type SP } from '@/lib/admin-list';

export const dynamic = 'force-dynamic';
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const TABS: { key: ReorderTabKey; en: string; ar: string }[] = [
  { key: 'out_of_stock', en: 'Out of stock', ar: 'نفد المخزون' },
  { key: 'last_piece', en: 'Last pieces', ar: 'آخر قطعة' },
  { key: 'short_stock', en: 'Short stock', ar: 'مخزون منخفض' },
  { key: 'running_fast', en: 'Running fast', ar: 'تُباع بسرعة' },
  { key: 'special_orders', en: 'Special orders', ar: 'طلبات خاصة' },
  { key: 'ignored', en: 'Ignored', ar: 'تم تجاهلها' },
];
const TAB_KEYS = TABS.map((t) => t.key);

export default async function ReorderRequestsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });
  if (!user) return null;
  if (!hasPermission(user.permissions, 'inventory.manage')) redirect({ href: '/admin', locale });

  const tabParam = one(sp.tab);
  const tab: ReorderTabKey = (TAB_KEYS as string[]).includes(tabParam ?? '') ? (tabParam as ReorderTabKey) : 'out_of_stock';
  const { page, perPage } = parseListParams(sp, { sortable: [], defaultSort: '' });
  const view = await getReorderView({ tab, page, perPage });

  const basePath = `/${locale}/admin/inventory/requests`; // locale-prefixed: for `back` + ListPagination (plain <a>)
  const back = `${basePath}${listQs(sp, {})}`;
  // Locale-RELATIVE for next-intl <Link>, which prepends the locale itself (avoids /en/en/…).
  const tabHref = (key: ReorderTabKey) => `/admin/inventory/requests${listQs(sp, { tab: key, page: undefined })}`;
  const isIgnored = tab === 'ignored';
  const flag = one(sp.done) ? 'done' : one(sp.error);

  const th = 'px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground';
  const td = 'px-3 py-2 text-sm';
  const numCls = (n: number) => (n > 0 ? 'text-foreground' : 'text-muted-foreground');
  const fmtDate = (d: Date | null) => (d ? d.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 font-heading text-xl font-semibold text-foreground">{tb('Requests — to buy', 'الطلبات — للشراء')}</h1>
      <p className="mb-4 max-w-3xl text-sm text-muted-foreground">
        {tb(
          'Products to restock, grouped by why. Each row shows units sold over 30 / 90 / 180 days and current sellable stock. Incoming and requested totals come from YeldnIN once connected; until then “requested” counts the reorder requests placed here.',
          'منتجات تحتاج إعادة تخزين، مجمّعة حسب السبب. يعرض كل صف المبيعات خلال ٣٠ و٩٠ و١٨٠ يومًا والمخزون الحالي القابل للبيع. تأتي أرقام «الوارد» و«المطلوب» من YeldnIN بعد الربط؛ وحتى ذلك الحين يَعُدّ «المطلوب» طلبات الشراء المُسجّلة هنا.',
        )}
      </p>

      {flag === 'done' && <div className="mb-4 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Done.', 'تم.')}</div>}
      {flag === 'forbidden' && <div className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb("You don't have permission for that.", 'ليس لديك صلاحية لذلك.')}</div>}
      {flag === 'invalid' && <div className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Check the values and try again.', 'راجع القيم وحاول مجددًا.')}</div>}
      {flag === '1' && <div className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Action failed — nothing was changed.', 'فشل الإجراء — لم يتغير شيء.')}</div>}

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-1.5 border-b border-border">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={tabHref(t.key)}
              className={`-mb-px rounded-t-md border-b-2 px-3 py-2 text-sm font-medium ${active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {tb(t.en, t.ar)} <span className="ms-1 text-xs text-muted-foreground">{view.counts[t.key]}</span>
            </Link>
          );
        })}
      </div>

      {!isIgnored && view.rows.length > 0 && (
        <ReorderBulkBar
          formId="reorderbulk"
          locale={locale}
          back={back}
          tab={tab}
          requestAction={bulkRequestAction}
          ignoreAction={bulkIgnoreAction}
          labels={{
            selectAll: tb('All', 'الكل'),
            selected: tb('selected', 'محدد'),
            request: tb('Request selected', 'طلب المحدد'),
            ignore: tb('Ignore selected', 'تجاهل المحدد'),
            requestConfirm: tb('Place a reorder request for each selected product at its suggested quantity?', 'إنشاء طلب شراء لكل منتج محدد بالكمية المقترحة؟'),
            ignoreConfirm: tb('Ignore the selected products for 30 days?', 'تجاهل المنتجات المحددة لمدة ٣٠ يومًا؟'),
          }}
        />
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[860px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              {!isIgnored && <th className={`${th} w-8`}></th>}
              <th className={th}>{tb('Product', 'المنتج')}</th>
              <th className={`${th} text-end`}>{tb('Stock', 'المخزون')}</th>
              <th className={`${th} text-end`} title={tb('Units sold, last 30 days', 'الوحدات المباعة، آخر ٣٠ يومًا')}>30d</th>
              <th className={`${th} text-end`} title={tb('Units sold, last 90 days', 'الوحدات المباعة، آخر ٩٠ يومًا')}>90d</th>
              <th className={`${th} text-end`} title={tb('Units sold, last 180 days', 'الوحدات المباعة، آخر ١٨٠ يومًا')}>180d</th>
              <th className={`${th} text-end`} title={tb('Purchased but not received — from YeldnIN', 'مُشترى ولم يُستلم — من YeldnIN')}>{tb('Incoming', 'الوارد')}</th>
              <th className={`${th} text-end`} title={tb('Open reorder requests', 'طلبات الشراء المفتوحة')}>{tb('Requested', 'مطلوب')}</th>
              <th className={`${th} text-end`}>{tb('Pre-orders', 'طلبات مسبقة')}</th>
              <th className={`${th} text-end`}>{tb('Actions', 'إجراءات')}</th>
            </tr>
          </thead>
          <tbody>
            {view.rows.length === 0 && (
              <tr><td colSpan={isIgnored ? 9 : 10} className="px-3 py-10 text-center text-sm text-muted-foreground">{tb('Nothing here right now.', 'لا شيء هنا حاليًا.')}</td></tr>
            )}
            {view.rows.map((r) => (
              <tr key={r.productId} className="border-b border-border last:border-0 align-middle">
                {!isIgnored && (
                  <td className="px-3 py-2">
                    <input type="checkbox" name="ids" value={r.productId} form="reorderbulk" className="size-4" aria-label={tb('Select', 'تحديد')} />
                  </td>
                )}
                <td className={td}>
                  <div className="flex items-center gap-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {r.image ? <img src={r.image} alt="" className="size-9 shrink-0 rounded-md border border-border object-cover" /> : <div className="size-9 shrink-0 rounded-md border border-border bg-muted" />}
                    <div className="min-w-0">
                      <Link href={`/admin/products/edit/${r.productId}`} className="line-clamp-1 font-medium text-foreground hover:text-primary">
                        {(locale === 'ar' ? r.nameAr : r.nameEn) || r.nameEn}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {r.sku}
                        {r.featured && <span className="ms-2 rounded bg-gold/15 px-1.5 py-0.5 text-[10px] font-medium text-gold">{tb('Featured', 'مميّز')}</span>}
                      </div>
                    </div>
                  </div>
                </td>
                <td className={`${td} text-end tabular-nums font-medium ${r.stock <= 0 ? 'text-destructive' : 'text-foreground'}`}>{r.stock}</td>
                <td className={`${td} text-end tabular-nums ${numCls(r.units30)}`}>{r.units30}</td>
                <td className={`${td} text-end tabular-nums ${numCls(r.units90)}`}>{r.units90}</td>
                <td className={`${td} text-end tabular-nums ${numCls(r.units180)}`}>{r.units180}</td>
                <td className={`${td} text-end tabular-nums text-muted-foreground`}>{r.incomingUnits ?? '—'}</td>
                <td className={`${td} text-end tabular-nums ${numCls(r.requestedUnits)}`}>{r.requestedUnits || '—'}</td>
                <td className={`${td} text-end tabular-nums ${numCls(r.preorderUnits)}`}>{r.preorderUnits || '—'}</td>
                <td className={`${td} text-end`}>
                  {isIgnored ? (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs text-muted-foreground">{tb('until', 'حتى')} {fmtDate(r.ignoredUntil)}</span>
                      <form action={unignoreAction}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="back" value={back} />
                        <input type="hidden" name="productId" value={r.productId} />
                        <button type="submit" className="h-8 rounded-md border border-border px-2.5 text-xs font-medium hover:bg-muted">{tb('Restore', 'استعادة')}</button>
                      </form>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      <form action={requestToBuyAction} className="flex items-center gap-1">
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="back" value={back} />
                        <input type="hidden" name="tab" value={tab} />
                        <input type="hidden" name="productId" value={r.productId} />
                        <input type="number" name="qty" min={1} defaultValue={r.suggestedQty} className="h-8 w-16 rounded-md border border-border bg-card px-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring" aria-label={tb('Quantity', 'الكمية')} />
                        <button type="submit" className="h-8 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:opacity-90">{tb('Request', 'طلب')}</button>
                      </form>
                      <form action={ignoreAction}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="back" value={back} />
                        <input type="hidden" name="productId" value={r.productId} />
                        <button type="submit" className="h-8 rounded-md border border-border px-2.5 text-xs font-medium hover:bg-muted" title={tb('Hide for 30 days', 'إخفاء لمدة ٣٠ يومًا')}>{tb('Ignore', 'تجاهل')}</button>
                      </form>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ListPagination total={view.total} page={view.page} perPage={view.perPage} sp={sp} basePath={basePath} locale={locale} />
    </div>
  );
}
