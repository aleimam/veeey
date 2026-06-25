import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { prisma } from '@/lib/prisma';

function loadPage(slug: string) {
  return prisma.cmsPage.findFirst({ where: { slug, status: 'PUBLISHED' } });
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { slug, locale } = await params;
  const page = await loadPage(slug);
  if (!page) return {};
  const title = (locale === 'ar' ? page.metaTitleAr || page.titleAr : page.metaTitleEn || page.titleEn) ?? page.titleEn;
  const description = (locale === 'ar' ? page.metaDescAr : page.metaDescEn) ?? undefined;
  return { title: `${title} — Veeey`, description: description ?? undefined };
}

export default async function CmsPageView({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const page = await loadPage(slug);
  if (!page) notFound();

  const title = (locale === 'ar' ? page.titleAr : page.titleEn) ?? page.titleEn;
  const body = (locale === 'ar' ? page.bodyAr : page.bodyEn) ?? page.bodyEn;

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-green-dark sm:text-4xl">{title}</h1>
      {body && <div className="mt-6 whitespace-pre-line leading-relaxed text-[color:var(--text-body)]">{body}</div>}
    </article>
  );
}
