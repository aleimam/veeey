import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { sanitizeRichHtml } from '@/lib/rich-text';
import { parseFaq } from '@/lib/faq';
import { FaqAccordion } from '@/components/storefront/faq-accordion';
import { AdminEditLink } from '@/components/storefront/admin-edit-link';

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
  const safeBody = body ? sanitizeRichHtml(body) : '';

  // FAQ renders as a searchable accordion when the body is structured with
  // h2 topics / h3 questions (audit P2 6.2); otherwise falls back to prose.
  const faq = slug === 'faq' ? parseFaq(safeBody) : null;
  const asFaq = faq && faq.count > 0;

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-3"><AdminEditLink href={`/admin/content/pages/edit/${page.id}`} locale={locale} /></div>
      <h1 className="text-3xl font-bold text-green-dark sm:text-4xl">{title}</h1>
      {asFaq ? (
        <div className="mt-6">
          {faq.intro && <div className="veeey-rich mb-6 leading-relaxed text-[color:var(--text-body)]" dangerouslySetInnerHTML={{ __html: faq.intro }} />}
          <FaqAccordion topics={faq.topics} locale={locale} />
        </div>
      ) : (
        safeBody && <div className="veeey-rich mt-6 leading-relaxed text-[color:var(--text-body)]" dangerouslySetInnerHTML={{ __html: safeBody }} />
      )}
    </article>
  );
}
