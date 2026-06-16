import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { prisma } from '@/lib/prisma';
import { pick } from '@/lib/admin-i18n';
import { formatEGP } from '@/lib/format';

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay()); // week starts Sunday
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    products,
    published,
    brands,
    categories,
    collections,
    pages,
    posts,
    ordersToday,
    ordersWeek,
    ordersMonth,
    revenueMonth,
    pendingOrders,
    lowStockLots,
    newCustomers,
    topSellerRows,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { status: 'PUBLISHED' } }),
    prisma.brand.count(),
    prisma.category.count(),
    prisma.collection.count(),
    prisma.cmsPage.count(),
    prisma.blogPost.count(),
    prisma.order.count({ where: { placedAt: { gte: startOfDay } } }),
    prisma.order.count({ where: { placedAt: { gte: startOfWeek } } }),
    prisma.order.count({ where: { placedAt: { gte: startOfMonth } } }),
    prisma.order.aggregate({
      where: { placedAt: { gte: startOfMonth } },
      _sum: { totalPiastres: true },
    }),
    prisma.order.count({
      where: { status: { in: ['PENDING_CONFIRMATION', 'PROCESSING', 'HOLD'] } },
    }),
    prisma.lot.count({ where: { status: 'LIVE', qtyOnHand: { lte: 5 } } }),
    prisma.customer.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { qty: true },
      orderBy: { _sum: { qty: 'desc' } },
      take: 5,
    }),
  ]);

  const topProducts = await prisma.product.findMany({
    where: { id: { in: topSellerRows.map((r) => r.productId) } },
    select: { id: true, nameEn: true, nameAr: true },
  });
  const nameById = new Map(topProducts.map((p) => [p.id, locale === 'ar' ? p.nameAr || p.nameEn : p.nameEn]));
  const topSellers = topSellerRows.map((r) => ({
    id: r.productId,
    name: nameById.get(r.productId) ?? r.productId,
    qty: r._sum.qty ?? 0,
  }));

  const tb = pick(locale);
  const revenueMonthPiastres = Number(revenueMonth._sum.totalPiastres ?? 0n);

  const opsStats = [
    { label: tb('Orders today', 'الطلبات اليوم'), value: String(ordersToday) },
    { label: tb('Orders this week', 'الطلبات هذا الأسبوع'), value: String(ordersWeek) },
    { label: tb('Orders this month', 'الطلبات هذا الشهر'), value: String(ordersMonth) },
    { label: tb('Revenue this month', 'الإيرادات هذا الشهر'), value: formatEGP(revenueMonthPiastres) },
    { label: tb('Pending / processing', 'قيد الانتظار / المعالجة'), value: String(pendingOrders) },
    { label: tb('Low-stock lots (≤5)', 'دفعات منخفضة المخزون (≤5)'), value: String(lowStockLots) },
    { label: tb('New customers this month', 'عملاء جدد هذا الشهر'), value: String(newCustomers) },
  ];
  const stats = [
    { label: tb('Products', 'المنتجات'), value: products, href: '/admin/products', sub: `${published} ${tb('published', 'منشور')}` },
    { label: tb('Brands', 'العلامات التجارية'), value: brands, href: '/admin/brands' },
    { label: tb('Categories', 'الفئات'), value: categories, href: '/admin/categories' },
    { label: tb('Collections', 'المجموعات'), value: collections, href: '/admin/collections' },
    { label: tb('Content pages', 'صفحات المحتوى'), value: pages, href: '/admin/content/pages' },
    { label: tb('Blog posts', 'مقالات المدونة'), value: posts, href: '/admin/content/blog' },
  ];

  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{tb('Dashboard', 'اللوحة الرئيسية')}</h1>

      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{tb('At a glance', 'نظرة سريعة')}</h2>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {opsStats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-5">
            <div className="text-sm text-muted-foreground">{s.label}</div>
            <div className="mt-1 text-2xl font-semibold text-foreground">{s.value}</div>
          </div>
        ))}
      </div>

      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{tb('Top sellers', 'الأكثر مبيعًا')}</h2>
      <div className="mb-8 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-2 text-start">{tb('Product', 'المنتج')}</th>
              <th className="p-2 text-end">{tb('Units sold', 'الوحدات المباعة')}</th>
            </tr>
          </thead>
          <tbody>
            {topSellers.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="p-2">{p.name}</td>
                <td className="p-2 text-end font-medium">{p.qty}</td>
              </tr>
            ))}
            {topSellers.length === 0 && (
              <tr>
                <td colSpan={2} className="p-4 text-center text-muted-foreground">
                  {tb('No sales yet.', 'لا توجد مبيعات بعد.')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{tb('Catalog', 'الكتالوج')}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-lg border border-border bg-card p-5 transition hover:border-primary"
          >
            <div className="text-sm text-muted-foreground">{s.label}</div>
            <div className="mt-1 text-3xl font-semibold text-foreground">{s.value}</div>
            {s.sub && <div className="mt-1 text-xs text-muted-foreground">{s.sub}</div>}
          </Link>
        ))}
      </div>
    </div>
  );
}
