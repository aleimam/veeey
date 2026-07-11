import { setRequestLocale } from 'next-intl/server';
import { redirect, Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth-guards';
import { hasPermission } from '@/lib/rbac';
import { pick } from '@/lib/admin-i18n';
import { formatEGP } from '@/lib/format';
import { getExpiryView, getExpiredStock } from '@/lib/inventory-expiry-service';
import { conditionLabel, isConditionVariant } from '@/lib/lot-condition';
import type { ExpiryTab } from '@/lib/inventory-reorder';
import { setExpiryPriceAction } from '@/server/inventory-reorder-actions';
import { ListPagination } from '@/components/admin/list-pagination';
import { parseListParams, listQs, type SP } from '@/lib/admin-list';

export const dynamic = 'force-dynamic';
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const TABS: { key: ExpiryTab; en: string; ar: string }[] = [
  { key: 'this_month', en: 'This month', ar: 'هذا الشهر' },
  { key: 'next_month', en: 'Next month', ar: 'الشهر القادم' },
  { key: 'quarter', en: 'Within 90 days', ar: 'خلال ٩٠ يومًا' },
  { key: 'bi_annual', en: 'Within 180 days', ar: 'خلال ١٨٠ يومًا' },
  { key: 'year', en: 'Within a year', ar: 'خلال سنة' },
];
const TAB_KEYS = TABS.map((t) => t.key);

export default async function ExpiryFightPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });
  if (!user) return null;
  if (!hasPermission(user.permissions, 'inventory.manage')) redirect({ href: '/admin', locale });

  const tabParam = one(sp.tab);
  const tab: ExpiryTab = (TAB_KEYS as string[]).includes(tabParam ?? '') ? (tabParam as ExpiryTab) : 'this_month';
  const { page, perPage } = parseListParams(sp, { sortable: [], defaultSort: '' });
  const [view, expired] = await Promise.all([getExpiryView({ tab, page, perPage }), getExpiredStock(100)]);

  const basePath = `/${locale}/admin/inventory/expiry`; // locale-prefixed: for `back` + ListPagination (plain <a>)
  const back = `${basePath}${listQs(sp, {})}`;
  // Locale-RELATIVE for next-intl <Link>, which prepends the locale itself (avoids /en/en/…).
  const tabHref = (key: ExpiryTab) => `/admin/inventory/expiry${listQs(sp, { tab: key, page: undefined })}`;
  const flag = one(sp.done) ? 'done' : one(sp.error);

  const th = 'px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground';
  const td = 'px-3 py-2.5 text-sm align-top';
  const numCls = (v: number) => (v > 0 ? 'text-foreground' : 'text-muted-foreground');
  const fmtDate = (d: Date) => d.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const urgencyCls = (days: number) => (days <= 30 ? 'text-destructive' : days <= 90 ? 'text-amber-600' : 'text-foreground');

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 font-heading text-xl font-semibold text-foreground">{tb('Expiry fight — to sell', 'معركة الصلاحية — للبيع')}</h1>
      <p className="mb-4 max-w-3xl text-sm text-muted-foreground">
        {tb(
          'Products with dated stock approaching expiry, soonest first. Each row shows its 3 nearest-expiry lots and recent sales. Mark a lot down with the quick price box to move it before it expires.',
          'منتجات لها مخزون مؤرَّخ يقترب من انتهاء الصلاحية، الأقرب أولًا. يعرض كل صف أقرب ٣ تشغيلات انتهاءً ومبيعاته الأخيرة. خفّض سعر أي تشغيلة من خانة السعر السريع لتصريفها قبل انتهائها.',
        )}
      </p>

      {flag === 'done' && <div className="mb-4 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Price updated.', 'تم تحديث السعر.')}</div>}
      {flag === 'forbidden' && <div className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb("You don't have permission for that.", 'ليس لديك صلاحية لذلك.')}</div>}
      {(flag === 'invalid' || flag === '1') && <div className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Action failed — check the value and try again.', 'فشل الإجراء — راجع القيمة وحاول مجددًا.')}</div>}

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

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[820px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={th}>{tb('Product', 'المنتج')}</th>
              <th className={`${th} text-end`}>30d</th>
              <th className={`${th} text-end`}>90d</th>
              <th className={`${th} text-end`}>180d</th>
              <th className={th}>{tb('Nearest expiries — stock, price, quick markdown', 'أقرب الصلاحيات — المخزون والسعر وتخفيض سريع')}</th>
            </tr>
          </thead>
          <tbody>
            {view.rows.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-10 text-center text-sm text-muted-foreground">{tb('Nothing expiring in this window.', 'لا شيء ينتهي في هذه الفترة.')}</td></tr>
            )}
            {view.rows.map((r) => (
              <tr key={r.productId} className="border-b border-border last:border-0">
                <td className={td}>
                  <div className="flex items-center gap-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {r.image ? <img src={r.image} alt="" className="size-9 shrink-0 rounded-md border border-border object-cover" /> : <div className="size-9 shrink-0 rounded-md border border-border bg-muted" />}
                    <div className="min-w-0">
                      <Link href={`/admin/products/edit/${r.productId}`} className="line-clamp-1 font-medium text-foreground hover:text-primary">
                        {(locale === 'ar' ? r.nameAr : r.nameEn) || r.nameEn}
                      </Link>
                      <div className="text-xs text-muted-foreground">{r.sku}</div>
                    </div>
                  </div>
                </td>
                <td className={`${td} text-end tabular-nums ${numCls(r.units30)}`}>{r.units30}</td>
                <td className={`${td} text-end tabular-nums ${numCls(r.units90)}`}>{r.units90}</td>
                <td className={`${td} text-end tabular-nums ${numCls(r.units180)}`}>{r.units180}</td>
                <td className={td}>
                  <div className="flex flex-col gap-1.5">
                    {r.lots.map((l) => (
                      <div key={l.lotId} className="flex flex-wrap items-center gap-2">
                        <span className={`w-24 shrink-0 text-xs font-medium tabular-nums ${urgencyCls(l.daysToExpiry)}`}>{fmtDate(l.expiry)}</span>
                        <span className="w-14 shrink-0 text-xs tabular-nums text-muted-foreground">× {l.stock}</span>
                        <span className="w-24 shrink-0 text-xs tabular-nums">{formatEGP(l.pricePiastres)}</span>
                        {l.onSale && <span className="rounded bg-gold/15 px-1.5 py-0.5 text-[10px] font-medium text-gold">{tb('Sale', 'تخفيض')}</span>}
                        <form action={setExpiryPriceAction} className="flex items-center gap-1">
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="back" value={back} />
                          <input type="hidden" name="lotId" value={l.lotId} />
                          <input
                            type="number"
                            name="egp"
                            step="0.01"
                            min={0}
                            placeholder={(l.pricePiastres / 100).toString()}
                            className="h-7 w-20 rounded-md border border-border bg-card px-2 text-xs tabular-nums outline-none focus:ring-2 focus:ring-ring"
                            aria-label={tb('New price (EGP)', 'السعر الجديد (ج.م)')}
                          />
                          <button type="submit" className="h-7 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:opacity-90">{tb('Set', 'حفظ')}</button>
                        </form>
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ListPagination total={view.total} page={view.page} perPage={view.perPage} sp={sp} basePath={basePath} locale={locale} />

      {/* Expired stock (V4 C6) — units sitting in EXPIRED lots, auto-swept daily */}
      <section className="mt-10">
        <h2 className="mb-1 font-heading text-lg font-semibold text-foreground">{tb('Expired stock', 'مخزون منتهي الصلاحية')}</h2>
        <p className="mb-3 max-w-3xl text-sm text-muted-foreground">
          {tb(
            'Lots whose expiry date has passed — automatically moved out of sellable stock every night. Dispose or write them off from the lot page.',
            'تشغيلات انتهت صلاحيتها — تُنقل تلقائيًا خارج المخزون القابل للبيع كل ليلة. تخلّص منها أو اشطبها من صفحة التشغيلة.',
          )}
        </p>
        {expired.totalLots === 0 ? (
          <div className="rounded-xl border border-border bg-card px-3 py-8 text-center text-sm text-muted-foreground">
            {tb('No expired stock — nothing is sitting past its date. 🎉', 'لا يوجد مخزون منتهي الصلاحية — لا شيء تجاوز تاريخه. 🎉')}
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-4 text-sm">
              <span className="rounded-lg bg-destructive/10 px-3 py-1.5 font-medium text-destructive">{expired.totalLots} {tb('lots', 'تشغيلة')}</span>
              <span className="rounded-lg bg-destructive/10 px-3 py-1.5 font-medium text-destructive">{expired.totalUnits} {tb('units', 'وحدة')}</span>
              <span className="rounded-lg bg-destructive/10 px-3 py-1.5 font-medium text-destructive">{formatEGP(expired.totalValuePiastres)} {tb('stuck value', 'قيمة عالقة')}</span>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[640px] border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className={th}>{tb('Product', 'المنتج')}</th>
                    <th className={th}>{tb('Expired', 'انتهت في')}</th>
                    <th className={`${th} text-end`}>{tb('Units', 'الوحدات')}</th>
                    <th className={`${th} text-end`}>{tb('Value', 'القيمة')}</th>
                    <th className={th} />
                  </tr>
                </thead>
                <tbody>
                  {expired.rows.map((r) => (
                    <tr key={r.lotId} className="border-b border-border last:border-0">
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
                              {isConditionVariant(r.condition) && <span className="ms-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">{conditionLabel(r.condition, locale)}</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className={`${td} text-destructive`}>{r.expiry ? fmtDate(r.expiry) : '—'}</td>
                      <td className={`${td} text-end tabular-nums`}>{r.qty}</td>
                      <td className={`${td} text-end tabular-nums`}>{formatEGP(r.valuePiastres)}</td>
                      <td className={`${td} text-end`}>
                        <Link href={`/admin/inventory/lots/edit/${r.lotId}`} className="text-sm text-primary hover:underline">{tb('Open lot', 'فتح التشغيلة')}</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {expired.totalLots > expired.rows.length && (
              <p className="mt-2 text-xs text-muted-foreground">
                {tb(`Showing ${expired.rows.length} of ${expired.totalLots} — see the lots list (status = EXPIRED) for the rest.`, `يعرض ${expired.rows.length} من ${expired.totalLots} — راجع قائمة التشغيلات (الحالة = منتهية) للباقي.`)}
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
