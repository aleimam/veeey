import { setRequestLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { richToText } from '@/lib/rich-text';
import { Link } from '@/i18n/navigation';
import { Icon } from '@/components/storefront/ui/icon';

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
  const fmtDate = (d: Date | null) =>
    d ? d.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-3xl font-bold text-green-dark">{t('title')}</h1>
      {posts.length === 0 ? (
        <p className="text-[color:var(--text-muted)]">{t('noPosts')}</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => {
            const title = (locale === 'ar' ? post.titleAr : post.titleEn) ?? post.titleEn;
            const excerpt = richToText((locale === 'ar' ? post.excerptAr : post.excerptEn) ?? post.excerptEn);
            return (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-[16px] border border-[color:var(--green-dark-05)] bg-white transition-all hover:-translate-y-[3px] hover:shadow-[var(--shadow-card-hover)]"
              >
                <span className="relative flex h-44 items-center justify-center overflow-hidden bg-green-wash">
                  {post.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.coverImage} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  ) : (
                    <Icon name="book-open" size={42} color="var(--green-mid)" />
                  )}
                </span>
                <span className="flex flex-1 flex-col p-5">
                  <span className="font-heading text-lg font-semibold leading-snug text-ink transition-colors group-hover:text-green-dark">{title}</span>
                  {excerpt && <span className="mt-2 line-clamp-3 text-sm leading-relaxed text-[color:var(--text-muted)]">{excerpt}</span>}
                  <span className="mt-auto flex items-center gap-2 pt-4 text-xs text-[color:var(--text-subtle)]">
                    {post.authorName && <span className="font-semibold text-green-dark">{post.authorName}</span>}
                    {post.authorName && post.publishedAt && <span aria-hidden>·</span>}
                    {post.publishedAt && <span>{fmtDate(post.publishedAt)}</span>}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
