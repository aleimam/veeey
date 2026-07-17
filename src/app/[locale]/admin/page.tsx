import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { prisma } from '@/lib/prisma';
import { getNumberSetting } from '@/lib/settings-service';
import { pick } from '@/lib/admin-i18n';
import { formatEGP } from '@/lib/format';
import { getCurrentUser } from '@/lib/auth-guards';
import { NAV_ITEMS, type AdminNavItem } from '@/lib/admin-nav';
import { QuickCards, type QuickCard } from '@/components/admin/quick-cards';
import { RecentOrdersTable } from '@/components/admin/recent-orders-table';
import { BarChart } from '@/components/admin/analytics/bar-chart';
import { trendToneClass, trendCornerClass, deltaAriaLabel } from '@/lib/kpi-trend';
import { TrendingUp, TrendingDown, ShoppingCart, UserPlus, PackageX, ArrowUpRight, ArrowDownRight, Minus, ArrowRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

const monthDay = (d: Date) => `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;

// Sections offered until a user has enough visit history of their own.
const DEFAULT_QUICK = ['/admin/orders', '/admin/products', '/admin/inventory', '/admin/customers', '/admin/analytics', '/admin/returns', '/admin/brands', '/admin/coupons', '/admin/reviews', '/admin/settings'];

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);

  // Personal quick-access cards: this user's most-visited sections (recorded by
  // AdminShell), permission-filtered, topped up with defaults. Count is an
  // admin setting (3–10, one or two rows).
  const [user, quickCardCountRaw] = await Promise.all([getCurrentUser(), getNumberSetting('dashboard.quickCardCount')]);
  const quickCardCount = Math.min(10, Math.max(3, Math.round(quickCardCountRaw) || 8));
  const usage = user
    ? await prisma.adminSectionUsage.findMany({ where: { userId: user.id }, orderBy: [{ count: 'desc' }, { section: 'asc' }], take: 30 })
    : [];
  // V5 audit D-09: deterministic order — count desc with a stable alphabetical
  // tie-break, so equal-usage tiles never shuffle between visits.
  const byHref = new Map(NAV_ITEMS.map((i) => [i.href, i]));
  const allowed = (i: AdminNavItem) => !i.permission || (user?.permissions.includes(i.permission) ?? false);
  const picks: AdminNavItem[] = [];
  for (const href of [...usage.map((u) => u.section), ...DEFAULT_QUICK]) {
    const item = byHref.get(href);
    if (item && item.href !== '/admin' && allowed(item) && !picks.includes(item)) picks.push(item);
    if (picks.length === quickCardCount) break;
  }
  const tNav = await getTranslations('admin');
  const quickCards: QuickCard[] = picks.map((i) => ({ href: i.href, label: tNav(`nav.${i.key}`), icon: i.key }));

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfDay);
  startOfYesterday.setDate(startOfDay.getDate() - 1);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekAgo = new Date(startOfDay);
  weekAgo.setDate(startOfDay.getDate() - 6);

  const [todayAgg, yestAgg, newCustomers, lowStockLots, pendingOrders, weekOrders, recentOrders, expiryLots, products, published, brands, categories, posts] =
    await Promise.all([
      prisma.order.aggregate({ where: { placedAt: { gte: startOfDay } }, _sum: { totalPiastres: true }, _count: true }),
      prisma.order.aggregate({ where: { placedAt: { gte: startOfYesterday, lt: startOfDay } }, _sum: { totalPiastres: true }, _count: true }),
      prisma.customer.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.lot.count({ where: { status: 'LIVE', qtyOnHand: { lte: 5 } } }),
      prisma.order.count({ where: { status: { in: ['PENDING', 'CONFIRMED', 'HOLD'] } } }),
      prisma.order.findMany({ where: { placedAt: { gte: weekAgo } }, select: { placedAt: true, totalPiastres: true } }),
      prisma.order.findMany({ orderBy: { placedAt: 'desc' }, take: 6, include: { customer: { select: { firstName: true, lastName: true } }, _count: { select: { items: true } } } }),
      prisma.lot.findMany({ where: { status: 'LIVE', qtyOnHand: { gt: 0 }, expiryDate: { not: null } }, orderBy: { expiryDate: 'asc' }, take: 6, include: { product: { select: { nameEn: true, nameAr: true } } } }),
      prisma.product.count(),
      prisma.product.count({ where: { status: 'PUBLISHED' } }),
      prisma.brand.count(),
      prisma.category.count(),
      prisma.blogPost.count(),
    ]);

  const revToday = Number(todayAgg._sum.totalPiastres ?? 0n);
  const revYest = Number(yestAgg._sum.totalPiastres ?? 0n);
  const ordToday = todayAgg._count;
  const ordYest = yestAgg._count;
  const delta = (a: number, b: number) => (b === 0 ? (a > 0 ? 100 : 0) : Math.round(((a - b) / b) * 100));

  const buckets = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekAgo);
    d.setDate(weekAgo.getDate() + i);
    return { label: monthDay(d), total: 0 };
  });
  for (const o of weekOrders) {
    const idx = Math.floor((o.placedAt.getTime() - weekAgo.getTime()) / 86400000);
    if (idx >= 0 && idx < 7) buckets[idx].total += Number(o.totalPiastres);
  }
  const weekTotal = buckets.reduce((s, b) => s + b.total, 0);

  // Local YYYY-MM-DD for the orders/customers date-range drill-downs.
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayStr = ymd(startOfDay);
  const monthStr = ymd(startOfMonth);
  const weekAgoStr = ymd(weekAgo);

  // V5 audit D-01: the revenue card's corner icon is a TREND icon — it must
  // follow the delta sign (up/down/flat), never a hardcoded trending-up.
  const revDelta = delta(revToday, revYest);
  const revTrendIcon = revDelta > 0 ? TrendingUp : revDelta < 0 ? TrendingDown : Minus;
  const kpis = [
    { label: tb('Revenue today', 'إيرادات اليوم'), value: formatEGP(revToday), d: revDelta, icon: revTrendIcon, trend: true, href: `/admin/orders?from=${todayStr}&to=${todayStr}` },
    { label: tb('Orders today', 'طلبات اليوم'), value: String(ordToday), d: delta(ordToday, ordYest), icon: ShoppingCart, href: `/admin/orders?from=${todayStr}&to=${todayStr}` },
    { label: tb('New customers (month)', 'عملاء جدد (الشهر)'), value: String(newCustomers), d: null, icon: UserPlus, href: `/admin/customers?from=${monthStr}` },
    { label: tb('Low-stock lots (≤5)', 'دفعات منخفضة (≤5)'), value: String(lowStockLots), d: null, icon: PackageX, warn: lowStockLots > 0, href: '/admin/inventory/lots?stock=low&status=LIVE' },
  ];
  const deltaWords = { up: tb('up', 'ارتفاع'), down: tb('down', 'انخفاض'), flat: tb('unchanged', 'بدون تغيير'), vs: tb('vs yesterday', 'مقابل أمس') };

  const quickLinks = [
    { label: tb('Products', 'المنتجات'), value: products, href: '/admin/products', sub: `${published} ${tb('published', 'منشور')}` },
    { label: tb('Brands', 'العلامات'), value: brands, href: '/admin/brands' },
    { label: tb('Categories', 'الفئات'), value: categories, href: '/admin/categories' },
    { label: tb('Blog posts', 'مقالات المدوّنة'), value: posts, href: '/admin/content/blog' },
  ];

  const expDays = (d: Date) => Math.round((d.getTime() - now.getTime()) / 86400000);

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-foreground">{tb('Dashboard', 'اللوحة الرئيسية')}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{tb('Here is today at Veeey.', 'هذه نظرة على يومك في فيي.')}</p>
        </div>
        {pendingOrders > 0 && (
          <Link href="/admin/orders?status=attention" className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:border-primary">
            <span className="flex size-2 rounded-full bg-gold" /> {tb(`${pendingOrders} orders need attention`, `${pendingOrders} طلبات تحتاج متابعة`)}
            <ArrowRight size={15} className="text-muted-foreground" />
          </Link>
        )}
      </div>

      {/* V5 audit D-09: dynamic tiles get an explicit heading naming the logic */}
      <QuickCards items={quickCards} heading={tb('Quick access — your most-visited sections', 'وصول سريع — أقسامك الأكثر زيارة')} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => {
          const Ic = k.icon;
          // Corner chip: trend cards follow the delta tone (D-01); others keep
          // their semantic tone (warn → gold, default → primary).
          const corner = k.trend && k.d !== null ? trendCornerClass(k.d) : k.warn ? 'bg-gold/15 text-gold' : 'bg-primary/10 text-primary';
          return (
            <Link key={k.label} href={k.href} className="block min-w-0 rounded-xl border border-border bg-card p-4 transition hover:border-primary hover:shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{k.label}</span>
                <span className={`flex size-8 items-center justify-center rounded-lg ${corner}`}><Ic size={17} /></span>
              </div>
              <div className="mt-2 text-2xl font-semibold text-foreground">{k.value}</div>
              {k.d !== null && (
                <div
                  className={`mt-1.5 inline-flex items-center gap-1 text-xs font-medium ${trendToneClass(k.d)}`}
                  aria-label={`${k.label}: ${deltaAriaLabel(k.d, deltaWords)}`}
                >
                  {k.d > 0 ? <ArrowUpRight size={14} aria-hidden /> : k.d < 0 ? <ArrowDownRight size={14} aria-hidden /> : <Minus size={14} aria-hidden />}
                  {k.d === 0 ? deltaWords.flat : `${Math.abs(k.d)}%`} {deltaWords.vs}
                </div>
              )}
            </Link>
          );
        })}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        {/* min-w-0 on grid children + fluid bars: the chart may never expand the page (V5 D-02/D-03) */}
        <div className="min-w-0 rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-foreground">{tb('Revenue · last 7 days', 'الإيرادات · آخر ٧ أيام')}</h2>
            <Link href={`/admin/orders?from=${weekAgoStr}&to=${todayStr}`} className="text-sm text-muted-foreground hover:text-primary hover:underline">{formatEGP(weekTotal)}</Link>
          </div>
          {/* V5 audit D-11: interactive bars (hover/focus tooltip, aria-labels,
              sr-only data table) via the shared BarChart. */}
          <BarChart data={buckets.map((b) => ({ label: b.label, value: b.total }))} unit="egp" />
        </div>

        <div className="min-w-0 rounded-xl border border-border bg-card p-4">
          <h2 className="mb-1 text-sm font-semibold text-foreground">{tb('Expiry & stock alerts', 'تنبيهات الصلاحية والمخزون')}</h2>
          {/* V5 audit D-08: legend + non-color severity cue (days-left text) */}
          <div className="mb-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-destructive" />≤60 {tb('days', 'يوم')}</span>
            <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-gold" />≤150 {tb('days', 'يوم')}</span>
            <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-primary" />{tb('later', 'أبعد')}</span>
          </div>
          {expiryLots.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{tb('No expiring stock.', 'لا يوجد مخزون قارب على الانتهاء.')}</p>
          ) : (
            <ul className="flex flex-col">
              <li className="flex items-center gap-2.5 pb-1 text-[11px] uppercase text-muted-foreground" aria-hidden>
                <span className="size-2 shrink-0" />
                <span className="min-w-0 flex-1">{tb('Product', 'المنتج')}</span>
                <span>{tb('Expiry', 'الصلاحية')}</span>
                <span className="w-10 text-end">{tb('Qty in stock', 'الكمية')}</span>
              </li>
              {expiryLots.map((l, idx) => {
                const days = l.expiryDate ? expDays(l.expiryDate) : 999;
                const sev = days <= 60 ? 'high' : days <= 150 ? 'medium' : 'low';
                const dot = days <= 60 ? 'bg-destructive' : days <= 150 ? 'bg-gold' : 'bg-primary';
                const dayTone = days <= 60 ? 'text-destructive' : days <= 150 ? 'text-gold' : 'text-muted-foreground';
                const name = (locale === 'ar' ? l.product.nameAr : l.product.nameEn) ?? l.product.nameEn;
                const dateStr = l.expiryDate ? monthDay(l.expiryDate) + '/' + l.expiryDate.getUTCFullYear() : '—';
                // D-07: same product + same expiry twice = two REAL lots — disambiguate
                // with the lot-id tail instead of looking like an accidental duplicate.
                const dup = expiryLots.some((o, i) => i !== idx && o.product.nameEn === l.product.nameEn && String(o.expiryDate) === String(l.expiryDate));
                const sevLabel = sev === 'high' ? tb('urgent', 'عاجل') : sev === 'medium' ? tb('soon', 'قريبًا') : tb('later', 'لاحقًا');
                return (
                  <li key={l.id} className="border-t border-border">
                    {/* D-06: the whole row is a focusable link to this product's lots */}
                    <Link
                      href={`/admin/inventory/lots?q=${encodeURIComponent(l.product.nameEn)}&status=LIVE`}
                      aria-label={`${name} — ${tb('expires', 'تنتهي في')} ${dateStr} (${days} ${tb('days', 'يوم')}, ${sevLabel}), ${l.qtyOnHand} ${tb('in stock', 'بالمخزون')}`}
                      className="flex items-center gap-2.5 py-2 text-sm transition-colors hover:bg-primary/5"
                    >
                      <span className={`size-2 shrink-0 rounded-full ${dot}`} aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-foreground">
                        {name}
                        {dup && <span className="ms-1 text-[10px] text-muted-foreground">#{l.id.slice(-4)}</span>}
                      </span>
                      <span className={`text-xs font-medium ${dayTone}`}>{days}d</span>
                      <span className="text-xs text-muted-foreground">{dateStr}</span>
                      <span className="w-10 text-end text-xs font-medium text-foreground">{l.qtyOnHand}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="min-w-0 rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">{tb('Recent orders', 'أحدث الطلبات')}</h2>
            <Link href="/admin/orders" className="text-xs font-medium text-primary hover:underline">{tb('View all', 'عرض الكل')}</Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{tb('No orders yet.', 'لا توجد طلبات بعد.')}</p>
          ) : (
            <RecentOrdersTable
              rows={recentOrders.map((o) => ({
                id: o.id,
                number: o.number,
                customer: [o.customer?.firstName, o.customer?.lastName].filter(Boolean).join(' ') || tb('Guest', 'زائر'),
                total: formatEGP(Number(o.totalPiastres)),
                status: o.status,
                date: monthDay(o.placedAt),
              }))}
              labels={{ order: tb('Order #', 'رقم الطلب'), customer: tb('Customer', 'العميل'), total: tb('Total', 'الإجمالي'), status: tb('Status', 'الحالة'), date: tb('Date', 'التاريخ') }}
            />
          )}
        </div>

        <div className="min-w-0 rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold text-foreground">{tb('Catalog', 'الكتالوج')}</h2>
          <div className="grid grid-cols-2 gap-3">
            {quickLinks.map((s) => (
              <Link key={s.label} href={s.href} className="rounded-lg border border-border p-3 transition hover:border-primary">
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className="mt-0.5 text-xl font-semibold text-foreground">{s.value}</div>
                {s.sub && <div className="text-[11px] text-muted-foreground">{s.sub}</div>}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
