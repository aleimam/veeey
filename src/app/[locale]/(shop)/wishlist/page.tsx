import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth-guards';
import { getWishlistItems } from '@/lib/wishlist-service';
import { toCardProduct } from '@/lib/storefront';
import { ProductCard } from '@/components/storefront/product-card';
import { toggleWishlistAction, setWishlistAlertsAction } from '@/server/engagement-actions';

export default async function WishlistPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getCurrentUser();
  if (!user?.customerId) redirect({ href: '/login', locale });
  if (!user?.customerId) return null;

  const items = await getWishlistItems(user.customerId);
  const t = await getTranslations('storefront.wishlist');

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-6 font-heading text-2xl font-semibold text-foreground">{t('title')}</h1>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
          {items.map((item) => (
            <div key={item.id} className="space-y-2">
              <ProductCard product={toCardProduct(item.product, locale)} locale={locale} />
              <form action={setWishlistAlertsAction} className="rounded-lg border border-border p-2 text-xs">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="itemId" value={item.id} />
                <label className="flex items-center gap-1"><input type="checkbox" name="notifyPriceDrop" defaultChecked={item.notifyPriceDrop} /> {t('priceDrop')}</label>
                <label className="flex items-center gap-1"><input type="checkbox" name="notifyBackInStock" defaultChecked={item.notifyBackInStock} /> {t('backInStock')}</label>
                <button className="mt-1 text-primary hover:underline">{t('saveAlerts')}</button>
              </form>
              <form action={toggleWishlistAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="productId" value={item.productId} />
                <input type="hidden" name="back" value="/wishlist" />
                <button className="text-xs text-muted-foreground hover:text-destructive">{t('remove')}</button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
