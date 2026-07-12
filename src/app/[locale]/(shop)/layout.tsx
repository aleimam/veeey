import { setRequestLocale } from 'next-intl/server';
import { auth } from '@/auth';
import { canAccessAdmin } from '@/lib/rbac';
import { readCartId, cartCount, getCart } from '@/lib/cart-service';
import { getSetting } from '@/lib/settings-service';
import { getHomeContent } from '@/lib/home-content-service';
import { getVisibleNavConfig } from '@/lib/nav-service';
import { getDisabledPaths } from '@/lib/feature-service';
import { getBranding } from '@/lib/branding-service';
import { brandingSiteName } from '@/lib/branding';
import { NavFontLink } from '@/components/storefront/chewy/nav-font-link';
import { AnnouncementBar } from '@/components/storefront/announcement-bar';
import { ChewyHeader, type CartLine } from '@/components/storefront/chewy/chewy-header';
import { SiteFooter } from '@/components/storefront/site-footer';
import { WhatsAppButton } from '@/components/storefront/whatsapp-button';
import { EntryDisclaimer } from '@/components/storefront/entry-disclaimer';

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
  const cartId = await readCartId();
  const count = cartId ? await cartCount(cartId) : 0;
  const cartLinesRaw = cartId ? await getCart(cartId, locale) : [];
  const subtotalPiastres = cartLinesRaw.reduce((s, l) => s + l.subtotalPiastres, 0);
  const cartLines: CartLine[] = cartLinesRaw.map((l) => ({
    name: l.name,
    image: l.image,
    qty: l.qty,
    pricePiastres: l.qty > 0 ? Math.round(l.subtotalPiastres / l.qty) : l.subtotalPiastres,
  }));
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
      <ChewyHeader
        locale={locale}
        nav={nav}
        cartCount={count}
        cartLines={cartLines}
        subtotalPiastres={subtotalPiastres}
        isStaff={isStaff}
        help={{ whatsapp: whatsapp ?? undefined, phone: phone ?? undefined }}
        branding={{ logoUrl: branding.logoUrl, logoLightUrl: branding.logoLightUrl, logoIconUrl: branding.logoIconUrl, siteName: brandingSiteName(branding, locale) }}
      />
      <main>{children}</main>
      <SiteFooter hiddenHrefs={hiddenHrefs} />
      <WhatsAppButton phone={whatsapp} />
      <EntryDisclaimer />
    </div>
  );
}
