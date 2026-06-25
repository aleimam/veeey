import { setRequestLocale } from 'next-intl/server';
import { auth } from '@/auth';
import { canAccessAdmin } from '@/lib/rbac';
import { readCartId, cartCount } from '@/lib/cart-service';
import { SiteHeader } from '@/components/storefront/site-header';
import { SiteFooter } from '@/components/storefront/site-footer';

// Auth pages (login/register) share the storefront header/footer so the logo +
// key links are present everywhere (#E header on all pages).
export const dynamic = 'force-dynamic';

export default async function AuthLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const cartId = await readCartId();
  const count = cartId ? await cartCount(cartId) : 0;
  const session = await auth();
  const isStaff = canAccessAdmin(session?.user?.permissions ?? []);
  return (
    <div className="veeey-shop flex min-h-screen flex-col bg-background">
      <SiteHeader locale={locale} cartCount={count} isStaff={isStaff} />
      {children}
      <SiteFooter />
    </div>
  );
}
