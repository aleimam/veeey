import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { prisma } from '@/lib/prisma';

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [products, published, brands, categories, collections, pages, posts] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { status: 'PUBLISHED' } }),
    prisma.brand.count(),
    prisma.category.count(),
    prisma.collection.count(),
    prisma.cmsPage.count(),
    prisma.blogPost.count(),
  ]);

  const stats = [
    { label: 'Products', value: products, href: '/admin/products', sub: `${published} published` },
    { label: 'Brands', value: brands, href: '/admin/brands' },
    { label: 'Categories', value: categories, href: '/admin/categories' },
    { label: 'Collections', value: collections, href: '/admin/collections' },
    { label: 'CMS Pages', value: pages, href: '/admin/content/pages' },
    { label: 'Blog Posts', value: posts, href: '/admin/content/blog' },
  ];

  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">Dashboard</h1>
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
