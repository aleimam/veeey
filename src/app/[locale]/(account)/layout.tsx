import { setRequestLocale } from 'next-intl/server';
import { auth } from '@/auth';
import { canAccessAdmin } from '@/lib/rbac';
import { readCartId, cartCount, getCart } from '@/lib/cart-service';
import { getNavConfig } from '@/lib/nav-service';
import { ChewyHeader, type CartLine } from '@/components/storefront/chewy/chewy-header';
import { NavFontLink } from '@/components/storefront/chewy/nav-font-link';
import { SiteFooter } from '@/components/storefront/site-footer';

// Account pages share the storefront chrome (header/footer).
export const dynamic = 'force-dynamic';

export default async function AccountLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
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
  const nav = await getNavConfig();
  const session = await auth();
  const isStaff = canAccessAdmin(session?.user?.permissions ?? []);
  return (
    <div className="veeey-shop min-h-screen bg-background">
      <NavFontLink nav={nav} />
      <ChewyHeader locale={locale} nav={nav} cartCount={count} cartLines={cartLines} subtotalPiastres={subtotalPiastres} isStaff={isStaff} />
      {children}
      <SiteFooter />
    </div>
  );
}
