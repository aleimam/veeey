import { setRequestLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { richToText } from '@/lib/rich-text';
import { Link } from '@/i18n/navigation';

export default async function BlogIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const posts = await prisma.blogPost.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    take: 50,
  });
  const t = await getTranslations('storefront.blogIndex');

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-3xl font-bold text-green-dark">{t('title')}</h1>
      {posts.length === 0 ? (
        <p className="text-[color:var(--text-muted)]">{t('noPosts')}</p>
      ) : (
        <ul className="space-y-6">
          {posts.map((post) => {
            const title = (locale === 'ar' ? post.titleAr : post.titleEn) ?? post.titleEn;
            const excerpt = richToText((locale === 'ar' ? post.excerptAr : post.excerptEn) ?? post.excerptEn);
            return (
              <li key={post.id} className="border-b border-[color:var(--slate-border)] pb-6">
                <Link href={`/blog/${post.slug}`} className="font-heading text-lg font-semibold text-ink transition-colors hover:text-green-dark">
                  {title}
                </Link>
                {excerpt && <p className="mt-2 text-sm text-[color:var(--text-muted)]">{excerpt}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
