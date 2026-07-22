import { setRequestLocale } from 'next-intl/server';
import { auth } from '@/auth';
import { canAccessAdmin } from '@/lib/rbac';
import { readCartSnapshot } from '@/lib/cart-service';
import { getSetting } from '@/lib/settings-service';
import { getHomeContent } from '@/lib/home-content-service';
import { getVisibleNavConfig } from '@/lib/nav-service';
import { getDisabledPaths } from '@/lib/feature-service';
import { getBranding } from '@/lib/branding-service';
import { brandingSiteName } from '@/lib/branding';
import { NavFontLink } from '@/components/storefront/chewy/nav-font-link';
import { AnnouncementBar } from '@/components/storefront/announcement-bar';
import { ChewyHeader } from '@/components/storefront/chewy/chewy-header';
import { CartProvider } from '@/components/storefront/cart-store';
import { SiteFooter } from '@/components/storefront/site-footer';
import { WhatsAppButton } from '@/components/storefront/whatsapp-button';
import { EntryDisclaimer } from '@/components/storefront/entry-disclaimer';
import { TrustpilotScript } from '@/components/storefront/trustpilot';

// Storefront reads live catalog/stock per request (SSR). Static/ISR perf tuning is a later pass.
export const dynamic = 'force-dynamic';

export default async function ShopLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const cart = await readCartSnapshot(locale);
  const whatsapp = await getSetting('store.whatsappNumber');
  const phone = await getSetting('store.phone');
  const home = await getHomeContent(locale);
  const nav = await getVisibleNavConfig();
  const hiddenHrefs = await getDisabledPaths();
  const branding = await getBranding();
  const session = await auth();
  const isStaff = canAccessAdmin(session?.user?.permissions ?? []);
  return (
    <div className="veeey-shop min-h-screen bg-background">
      <NavFontLink nav={nav} />
      {home.announcementEnabled && <AnnouncementBar text={home.announcement} />}
      {/* Wraps the header AND the page: adding from a product card has to move
          the header badge and open its drawer without a navigation. */}
      <CartProvider initial={cart} locale={locale}>
        <ChewyHeader
          locale={locale}
          nav={nav}
          isStaff={isStaff}
          help={{ whatsapp: whatsapp ?? undefined, phone: phone ?? undefined }}
          branding={{ logoUrl: branding.logoUrl, logoLightUrl: branding.logoLightUrl, logoIconUrl: branding.logoIconUrl, siteName: brandingSiteName(branding, locale) }}
        />
        <main>{children}</main>
      </CartProvider>
      <SiteFooter hiddenHrefs={hiddenHrefs} />
      <WhatsAppButton phone={whatsapp} />
      <EntryDisclaimer />
      <TrustpilotScript />
    </div>
  );
}
