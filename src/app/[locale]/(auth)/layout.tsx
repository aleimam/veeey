import { setRequestLocale } from 'next-intl/server';
import { auth } from '@/auth';
import { canAccessAdmin } from '@/lib/rbac';
import { readCartSnapshot } from '@/lib/cart-service';
import { getNavConfig } from '@/lib/nav-service';
import { ChewyHeader } from '@/components/storefront/chewy/chewy-header';
import { CartProvider } from '@/components/storefront/cart-store';
import { NavFontLink } from '@/components/storefront/chewy/nav-font-link';
import { SiteFooter } from '@/components/storefront/site-footer';

// Auth pages (login/register) share the storefront chrome.
export const dynamic = 'force-dynamic';

export default async function AuthLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const cart = await readCartSnapshot(locale);
  const nav = await getNavConfig();
  const session = await auth();
  const isStaff = canAccessAdmin(session?.user?.permissions ?? []);
  return (
    <div className="veeey-shop flex min-h-screen flex-col bg-background">
      <NavFontLink nav={nav} />
      <CartProvider initial={cart} locale={locale}>
        <ChewyHeader locale={locale} nav={nav} isStaff={isStaff} />
        {children}
      </CartProvider>
      <SiteFooter />
    </div>
  );
}
