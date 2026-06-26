import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { prisma } from '@/lib/prisma';
import { pick } from '@/lib/admin-i18n';
import { formatEGP } from '@/lib/format';
import { StatusBadge } from '@/components/admin/ui';
import { TrendingUp, ShoppingCart, UserPlus, PackageX, ArrowUpRight, ArrowDownRight, Clock, ArrowRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

const monthDay = (d: Date) => `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);

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
      prisma.order.count({ where: { status: { in: ['PENDING_CONFIRMATION', 'PROCESSING', 'HOLD'] } } }),
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
  const maxBucket = Math.max(1, ...buckets.map((b) => b.total));
  const weekTotal = buckets.reduce((s, b) => s + b.total, 0);

  const kpis = [
    { label: tb('Revenue today', 'إيرادات اليوم'), value: formatEGP(revToday), d: delta(revToday, revYest), icon: TrendingUp },
    { label: tb('Orders today', 'طلبات اليوم'), value: String(ordToday), d: delta(ordToday, ordYest), icon: ShoppingCart },
    { label: tb('New customers (month)', 'عملاء جدد (الشهر)'), value: String(newCustomers), d: null, icon: UserPlus },
    { label: tb('Low-stock lots (≤5)', 'دفعات منخفضة (≤5)'), value: String(lowStockLots), d: null, icon: PackageX, warn: lowStockLots > 0 },
  ];

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
          <Link href="/admin/orders" className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:border-primary">
            <span className="flex size-2 rounded-full bg-gold" /> {tb(`${pendingOrders} orders need attention`, `${pendingOrders} طلبات تحتاج متابعة`)}
            <ArrowRight size={15} className="text-muted-foreground" />
          </Link>
        )}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => {
          const Ic = k.icon;
          return (
            <div key={k.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{k.label}</span>
                <span className={`flex size-8 items-center justify-center rounded-lg ${k.warn ? 'bg-gold/15 text-gold' : 'bg-primary/10 text-primary'}`}><Ic size={17} /></span>
              </div>
              <div className="mt-2 text-2xl font-semibold text-foreground">{k.value}</div>
              {k.d !== null && (
                <div className={`mt-1.5 inline-flex items-center gap-1 text-xs font-medium ${k.d >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {k.d >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />} {Math.abs(k.d)}% {tb('vs yesterday', 'مقابل أمس')}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-foreground">{tb('Revenue · last 7 days', 'الإيرادات · آخر ٧ أيام')}</h2>
            <span className="text-sm text-muted-foreground">{formatEGP(weekTotal)}</span>
          </div>
          <div className="flex h-40 items-end gap-2">
            {buckets.map((b, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex w-full items-end justify-center" style={{ height: '128px' }}>
                  <div className="w-full max-w-[34px] rounded-t-md bg-primary/80" style={{ height: `${Math.max(4, Math.round((b.total / maxBucket) * 128))}px` }} title={formatEGP(b.total)} />
                </div>
                <span className="text-[11px] text-muted-foreground">{b.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">{tb('Expiry & stock alerts', 'تنبيهات الصلاحية والمخزون')}</h2>
          {expiryLots.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{tb('No expiring stock.', 'لا يوجد مخزون قارب على الانتهاء.')}</p>
          ) : (
            <ul className="flex flex-col">
              {expiryLots.map((l) => {
                const days = l.expiryDate ? expDays(l.expiryDate) : 999;
                const dot = days <= 60 ? 'bg-destructive' : days <= 150 ? 'bg-gold' : 'bg-primary';
                return (
                  <li key={l.id} className="flex items-center gap-2.5 border-t border-border py-2 text-sm first:border-t-0">
                    <span className={`size-2 shrink-0 rounded-full ${dot}`} />
                    <span className="min-w-0 flex-1 truncate text-foreground">{(locale === 'ar' ? l.product.nameAr : l.product.nameEn) ?? l.product.nameEn}</span>
                    <span className="text-xs text-muted-foreground">{l.expiryDate ? monthDay(l.expiryDate) + '/' + l.expiryDate.getUTCFullYear() : '—'}</span>
                    <span className="w-10 text-end text-xs font-medium text-foreground">{l.qtyOnHand}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">{tb('Recent orders', 'أحدث الطلبات')}</h2>
            <Link href="/admin/orders" className="text-xs font-medium text-primary hover:underline">{tb('View all', 'عرض الكل')}</Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{tb('No orders yet.', 'لا توجد طلبات بعد.')}</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id} className="border-t border-border first:border-t-0">
                    <td className="py-2.5 font-medium text-foreground">{o.number}</td>
                    <td className="py-2.5 text-muted-foreground">{[o.customer?.firstName, o.customer?.lastName].filter(Boolean).join(' ') || tb('Guest', 'زائر')}</td>
                    <td className="py-2.5 text-foreground">{formatEGP(Number(o.totalPiastres))}</td>
                    <td className="py-2.5"><StatusBadge status={o.status} /></td>
                    <td className="py-2.5 text-end text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><Clock size={12} /> {monthDay(o.placedAt)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
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
