import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
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
      {body && <div className="mt-6 whitespace-pre-line leading-relaxed text-[color:var(--text-body)]">{body}</div>}
    </article>
  );
}
