import { getSetting } from '@/lib/settings-service';
import { activeSocialLinks } from '@/lib/social-service';
import { getBranding } from '@/lib/branding-service';
import { DEFAULT_BRANDING, type Branding } from '@/lib/branding';

const SITE = 'https://veeey.com';

/**
 * Sitewide Organization + WebSite structured data. This is what lets Google show
 * a brand knowledge panel + logo for "Veeey", link your social profiles, and put
 * a search box under your result (the WebSite SearchAction). Rendered once in the
 * root layout so it appears on every page.
 */
export async function SiteJsonLd({ locale }: { locale: string }) {
  let email = 'info@veeey.com';
  let whatsapp = '';
  let socials: { platform: string; url: string }[] = [];
  let branding: Branding = DEFAULT_BRANDING;
  try {
    [email, whatsapp, socials, branding] = await Promise.all([
      getSetting('store.contactEmail'),
      getSetting('store.whatsappNumber'),
      activeSocialLinks(),
      getBranding(),
    ]);
  } catch {
    // DB hiccup → still emit a minimal Organization from the constants above.
  }
  const logoUrl = branding.logoUrl ? (branding.logoUrl.startsWith('/') ? `${SITE}${branding.logoUrl}` : branding.logoUrl) : `${SITE}/brand/veeey-logo.png`;

  const sameAs = socials
    .filter((s) => s.platform !== 'whatsapp' && /^https?:\/\//i.test(s.url))
    .map((s) => s.url);
  const phone = whatsapp.replace(/[^0-9]/g, '');

  const organization = {
    '@type': 'Organization',
    '@id': `${SITE}/#organization`,
    name: branding.siteNameEn,
    url: SITE,
    logo: logoUrl,
    image: logoUrl,
    ...(email ? { email } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(phone
      ? {
          contactPoint: {
            '@type': 'ContactPoint',
            telephone: `+${phone}`,
            contactType: 'customer service',
            areaServed: 'EG',
            availableLanguage: ['en', 'ar'],
          },
        }
      : {}),
  };

  const website = {
    '@type': 'WebSite',
    '@id': `${SITE}/#website`,
    name: branding.siteNameEn,
    url: SITE,
    publisher: { '@id': `${SITE}/#organization` },
    inLanguage: locale === 'ar' ? 'ar-EG' : 'en-US',
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE}/${locale}/search?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };

  const graph = { '@context': 'https://schema.org', '@graph': [organization, website] };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }} />;
}
