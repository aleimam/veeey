import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getPublishedPage } from '@/lib/page-layout-service';
import { resolveHomeData, type HomeData } from '@/lib/home-layout-service';
import { ChewyHome } from '@/components/storefront/chewy/chewy-home';
import { AdminEditLink } from '@/components/storefront/admin-edit-link';

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { slug, locale } = await params;
  const page = await getPublishedPage(slug);
  if (!page) return {};
  const title = (locale === 'ar' ? page.row.titleAr : page.row.titleEn) || page.row.titleEn;
  return { title: `${title} — Veeey` };
}

export default async function LandingPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const page = await getPublishedPage(slug);
  if (!page) notFound();

  let data: HomeData = { bestsellers: [], deals: [], rows: {} };
  try {
    data = await resolveHomeData(page.blocks, locale);
  } catch {
    // DB hiccup → render structure without product data.
  }

  return (
    <>
      <div className="mx-auto max-w-[1440px] px-4 pt-3 sm:px-6">
        <AdminEditLink href={`/admin/landing/edit/${page.row.id}`} locale={locale} />
      </div>
      <ChewyHome locale={locale} blocks={page.blocks} data={data} />
    </>
  );
}
