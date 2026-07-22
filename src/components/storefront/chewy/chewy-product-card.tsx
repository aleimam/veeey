import Image from 'next/image';
import { formatEGP } from '@/lib/format';
import { pick } from '@/lib/admin-i18n';
import { Link } from '@/i18n/navigation';
import { toggleWishlistAction } from '@/server/engagement-actions';
import { AddToCartButton } from '@/components/storefront/add-to-cart';
import { Icon } from '@/components/storefront/ui/icon';
import { Rating } from '@/components/storefront/ui/rating';
import { isFeatureEnabledCached } from '@/lib/feature-service';
import type { Product } from '@/components/storefront/product-card';

/**
 * Chewy-pattern product card (dense "rich" variant): deal badge, brand, name,
 * rating, price (with strike-through), expiry-deal + Refill hints, wishlist
 * heart, add-to-cart. Wired to real catalog data; Refill is a visual
 * subscribe-&-save cue (no recurring billing yet). Bilingual via pick().
 */
export async function ChewyProductCard({ product, locale = 'en' }: { product: Product; locale?: string }) {
  const t = pick(locale);
  const showRefill = await isFeatureEnabledCached('refill'); // hide the "Refill & save" cue when Refill is off
  const pct = product.oldPricePiastres
    ? Math.max(1, Math.round((1 - product.pricePiastres / product.oldPricePiastres) * 100))
    : 0;
  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-[16px] border border-[color:var(--green-dark-05)] bg-white transition-all duration-200 hover:-translate-y-[3px] hover:shadow-[var(--shadow-card-hover)]">
      <Link href={`/products/${product.slug}`} className="relative flex aspect-square items-center justify-center bg-white">
        <div className="absolute start-3 top-3 z-10 flex flex-col gap-1.5">
          {pct > 0 ? (
            <span className="rounded-full bg-gold px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.04em] text-ink">
              {t(`Deal −${pct}%`, `خصم ${pct}٪`)}
            </span>
          ) : product.badge ? (
            <span className="rounded-full bg-green-dark px-2.5 py-1 text-[11px] font-bold text-white">{product.badge.label}</span>
          ) : null}
        </div>
        {product.image ? (
          <Image src={product.image} alt={`${product.brand} ${product.name}`} fill sizes="(max-width:640px) 50vw, 20vw" className="object-contain p-[10%]" />
        ) : (
          <span className="flex flex-col items-center gap-2 text-[color:var(--text-subtle)]">
            <Icon name="package" size={40} color="var(--slate-45)" />
            <span className="text-[11px] uppercase tracking-[0.08em]">{product.brand}</span>
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-[18px] pb-0">
        <span className="text-xs font-bold tracking-[0.02em] text-green-dark">{product.brand}</span>
        <h3 className="line-clamp-2 min-h-[38px] text-sm font-semibold leading-snug text-ink">
          <Link href={`/products/${product.slug}`}>{product.name}</Link>
        </h3>
        <Rating value={product.rating} count={product.reviews} emptyLabel={t('Be the first to review', 'كن أول من يقيّم')} />
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className={`text-[22px] font-bold ${pct > 0 ? 'text-green-dark' : 'text-ink'}`}>{formatEGP(product.pricePiastres)}</span>
          {product.oldPricePiastres ? <span className="text-[13px] text-[color:var(--text-subtle)] line-through">{formatEGP(product.oldPricePiastres)}</span> : null}
        </div>
        {product.expiry && (
          <div className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-gold-deep">
            <Icon name="calendar-clock" size={13} color="var(--gold-deep)" /> {t(`Exp ${product.expiry} lot priced lower`, `سعر أقل لتشغيلة ${product.expiry}`)}
          </div>
        )}
        {showRefill && (
          <div className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-green-mid">
            <Icon name="repeat" size={13} color="var(--green-mid)" /> {t('Refill & save 15%', 'ريفيل ووفّر ١٥٪')}
          </div>
        )}
      </div>

      <div className="p-[18px]">
        <AddToCartButton
          productId={product.id}
          locale={locale}
          label={t('Add to Cart', 'أضف للسلة')}
          inCartLabel={t('In cart', 'في السلة')}
          ariaLabel={t(`Add ${product.name} to cart`, `أضف ${product.name} إلى السلة`)}
        />
      </div>

      <form action={toggleWishlistAction} className="absolute end-3 top-3 z-10">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="productId" value={product.id} />
        <input type="hidden" name="back" value="/products" />
        <button
          type="submit"
          aria-label={t('Save to wishlist', 'أضف للمفضلة')}
          className="flex size-[34px] items-center justify-center rounded-full bg-white/90 text-slate-45 shadow-[var(--shadow-xs)] transition-colors hover:text-error"
        >
          <Icon name="heart" size={17} />
        </button>
      </form>
    </article>
  );
}
