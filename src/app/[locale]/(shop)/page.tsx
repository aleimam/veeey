import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { getHomeLayout, resolveHomeData, type HomeData } from '@/lib/home-layout-service';
import { getSetting } from '@/lib/settings-service';
import { getFeatureStates } from '@/lib/feature-service';
import { ChewyHome } from '@/components/storefront/chewy/chewy-home';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const ar = locale === 'ar';
  const [title, description] = await Promise.all([
    getSetting(ar ? 'seo.homeTitleAr' : 'seo.homeTitleEn'),
    getSetting(ar ? 'seo.homeDescAr' : 'seo.homeDescEn'),
  ]);
  return {
    metadataBase: new URL('https://veeey.com'),
    title,
    description,
    // A localized homepage title stops Google from inventing one from the hero copy.
    alternates: { canonical: `/${locale}`, languages: { en: '/en', ar: '/ar', 'x-default': '/en' } },
    openGraph: {
      title,
      description,
      url: `/${locale}`,
      siteName: 'Veeey',
      type: 'website',
      locale: ar ? 'ar_EG' : 'en_US',
      images: ['/brand/veeey-logo.png'],
    },
    twitter: { card: 'summary_large_image', title, description, images: ['/brand/veeey-logo.png'] },
  };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ff = await getFeatureStates();
  // Hide the Learn/Blog home section when the blog feature is switched off.
  const blocks = (await getHomeLayout()).filter((b) => ff.blog || b.type !== 'learn-blog');
  let data: HomeData = { bestsellers: [], deals: [], rows: {} };
  try {
    data = await resolveHomeData(blocks, locale);
  } catch {
    // DB hiccup → still render the page structure, just without product data.
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: data.bestsellers.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: `${p.brand} ${p.name}`.trim() })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ChewyHome locale={locale} blocks={blocks} data={data} />
    </>
  );
}
