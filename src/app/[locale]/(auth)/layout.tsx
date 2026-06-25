import { setRequestLocale } from 'next-intl/server';
import { auth } from '@/auth';
import { canAccessAdmin } from '@/lib/rbac';
import { readCartId, cartCount, getCart } from '@/lib/cart-service';
import { ChewyHeader, type CartLine } from '@/components/storefront/chewy/chewy-header';
import { SiteFooter } from '@/components/storefront/site-footer';

// Auth pages (login/register) share the storefront chrome.
export const dynamic = 'force-dynamic';

export default async function AuthLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
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
  const session = await auth();
  const isStaff = canAccessAdmin(session?.user?.permissions ?? []);
  return (
    <div className="veeey-shop flex min-h-screen flex-col bg-background">
      <ChewyHeader locale={locale} cartCount={count} cartLines={cartLines} subtotalPiastres={subtotalPiastres} isStaff={isStaff} />
      {children}
      <SiteFooter />
    </div>
  );
}
