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
    <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-3xl font-bold text-green-dark">{t('title')}</h1>
      {items.length === 0 ? (
        <p className="text-sm text-[color:var(--text-muted)]">{t('empty')}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
          {items.map((item) => (
            <div key={item.id} className="space-y-2">
              <ProductCard product={toCardProduct(item.product, locale)} locale={locale} />
              <form action={setWishlistAlertsAction} className="rounded-[10px] border border-[color:var(--slate-border)] p-2.5 text-xs text-ink">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="itemId" value={item.id} />
                <label className="flex items-center gap-1.5"><input type="checkbox" name="notifyPriceDrop" defaultChecked={item.notifyPriceDrop} className="accent-[color:var(--green-dark)]" /> {t('priceDrop')}</label>
                <label className="mt-1 flex items-center gap-1.5"><input type="checkbox" name="notifyBackInStock" defaultChecked={item.notifyBackInStock} className="accent-[color:var(--green-dark)]" /> {t('backInStock')}</label>
                <button className="mt-1.5 font-semibold text-green-dark hover:text-lime-press">{t('saveAlerts')}</button>
              </form>
              <form action={toggleWishlistAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="productId" value={item.productId} />
                <input type="hidden" name="back" value="/wishlist" />
                <button className="text-xs text-slate-45 hover:text-error">{t('remove')}</button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
