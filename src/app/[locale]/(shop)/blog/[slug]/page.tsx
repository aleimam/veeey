import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { prisma } from '@/lib/prisma';

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
      <h1 className="font-heading text-3xl font-semibold text-foreground">{title}</h1>
      {body && <div className="mt-6 whitespace-pre-line leading-relaxed text-foreground/80">{body}</div>}
    </article>
  );
}
