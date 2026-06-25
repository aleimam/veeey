import { setRequestLocale } from 'next-intl/server';
import { auth } from '@/auth';
import { canAccessAdmin } from '@/lib/rbac';
import { readCartId, cartCount } from '@/lib/cart-service';
import { getSetting } from '@/lib/settings-service';
import { getHomeContent } from '@/lib/home-content-service';
import { AnnouncementBar } from '@/components/storefront/announcement-bar';
import { SiteHeader } from '@/components/storefront/site-header';
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
  const whatsapp = await getSetting('store.whatsappNumber');
  const home = await getHomeContent(locale);
  const session = await auth();
  const isStaff = canAccessAdmin(session?.user?.permissions ?? []);
  return (
    <div className="veeey-shop min-h-screen bg-background">
      <AnnouncementBar text={home.announcement} />
      <SiteHeader locale={locale} cartCount={count} isStaff={isStaff} />
      <main>{children}</main>
      <SiteFooter />
      <WhatsAppButton phone={whatsapp} />
      <EntryDisclaimer />
    </div>
  );
}
