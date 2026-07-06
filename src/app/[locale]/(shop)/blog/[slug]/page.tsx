import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { sanitizeRichHtml } from '@/lib/rich-text';
import { AdminEditLink } from '@/components/storefront/admin-edit-link';

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const post = await prisma.blogPost.findFirst({ where: { slug, status: 'PUBLISHED' } });
  if (!post) notFound();

  const title = (locale === 'ar' ? post.titleAr : post.titleEn) ?? post.titleEn;
  const body = (locale === 'ar' ? post.bodyAr : post.bodyEn) ?? post.bodyEn;

  return (
    <article className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-3"><AdminEditLink href={`/admin/content/blog/edit/${post.id}`} locale={locale} /></div>
      <h1 className="text-3xl font-bold text-green-dark sm:text-4xl">{title}</h1>
      {(post.authorName || post.publishedAt) && (
        <div className="mt-3 flex items-center gap-2 text-sm text-[color:var(--text-subtle)]">
          {post.authorName && <span className="font-semibold text-green-dark">{post.authorName}</span>}
          {post.authorName && post.publishedAt && <span aria-hidden>·</span>}
          {post.publishedAt && (
            <time dateTime={post.publishedAt.toISOString()}>
              {post.publishedAt.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </time>
          )}
        </div>
      )}
      {post.coverImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.coverImage} alt="" className="mt-6 w-full rounded-[16px] object-cover" />
      )}
      {body && <div className="veeey-rich mt-6 leading-relaxed text-[color:var(--text-body)]" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(body) }} />}
    </article>
  );
}
