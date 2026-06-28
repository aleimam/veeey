import { setRequestLocale } from 'next-intl/server';
import { getHomeLayout, resolveHomeData, type HomeData } from '@/lib/home-layout-service';
import { ChewyHome } from '@/components/storefront/chewy/chewy-home';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const blocks = await getHomeLayout();
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
