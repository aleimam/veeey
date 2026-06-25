import Image from 'next/image'
import { ShoppingCart } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { formatEGP, formatPoints } from '@/lib/format'
import { Link } from '@/i18n/navigation'
import { addToCartAction } from '@/server/cart-actions'
import { Chip } from '@/components/storefront/ui/chip'
import { Rating } from '@/components/storefront/ui/rating'

export type Product = {
  id: string
  slug: string
  brand: string
  name: string
  image: string
  rating: number
  reviews: number
  expiry: string
  pricePiastres: number
  oldPricePiastres?: number
  points: number
  badge?: { type: 'short-expiry' | 'pre-order'; label: string }
}

export function ProductCard({ product, locale = 'en' }: { product: Product; locale?: string }) {
  const t = useTranslations('storefront.productCard')
  return (
    <article className="v-card v-card--hover v-product">
      <Link href={`/products/${product.slug}`} className="v-product__media">
        {product.image ? (
          <Image
            src={product.image}
            alt={`${product.brand} ${product.name}`}
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            className="object-cover"
          />
        ) : (
          <span className="v-product__media-ph">{product.brand || 'Veeey'}</span>
        )}
        <div className="v-product__chips">
          {product.badge && (
            <Chip variant={product.badge.type === 'short-expiry' ? 'sale' : 'base'}>{product.badge.label}</Chip>
          )}
          {product.expiry && <Chip variant="soft">{product.expiry}</Chip>}
        </div>
      </Link>

      <div className="v-product__body">
        {product.brand && <span className="v-product__brand">{product.brand}</span>}
        <h3 className="v-product__name">
          <Link href={`/products/${product.slug}`} className="hover:text-green-dark">
            {product.name}
          </Link>
        </h3>

        <Rating value={product.rating} count={product.reviews} />

        <div className="v-product__meta">
          <div>
            <span className="v-product__price">{formatEGP(product.pricePiastres)}</span>
            {product.oldPricePiastres ? (
              <span className="v-product__price-was">{formatEGP(product.oldPricePiastres)}</span>
            ) : null}
          </div>
          {product.points > 0 && (
            <span className="v-product__points">{t('earnPoints', { points: formatPoints(product.points) })}</span>
          )}
        </div>
      </div>

      <div className="v-product__foot">
        <form action={addToCartAction}>
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="qty" value="1" />
          <input type="hidden" name="locale" value={locale} />
          <button
            type="submit"
            aria-label={t('addToCart', { name: product.name })}
            className="v-btn v-btn--primary v-btn--sm v-btn--block"
          >
            <span className="v-btn__icon" aria-hidden="true">
              <ShoppingCart className="size-full" />
            </span>
            {t('add')}
          </button>
        </form>
      </div>
    </article>
  )
}
