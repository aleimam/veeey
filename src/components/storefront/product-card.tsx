import Image from 'next/image'
import { Star, Plus } from 'lucide-react'
import { formatEGP, formatPoints } from '@/lib/format'
import { Link } from '@/i18n/navigation'
import { addToCartAction } from '@/server/cart-actions'

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

function StarRating({ rating, reviews }: { rating: number; reviews: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={
              i < Math.round(rating)
                ? 'size-3.5 fill-gold text-gold'
                : 'size-3.5 fill-border text-border'
            }
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">
        {rating.toFixed(1)} ({reviews})
      </span>
      <span className="sr-only">
        Rated {rating} out of 5 from {reviews} reviews
      </span>
    </div>
  )
}

export function ProductCard({ product, locale = 'en' }: { product: Product; locale?: string }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-1">
      <Link
        href={`/products/${product.slug}`}
        className="relative block aspect-square overflow-hidden bg-surface"
      >
        <Image
          src={product.image || '/placeholder.svg'}
          alt={`${product.brand} ${product.name}`}
          fill
          sizes="(max-width: 640px) 50vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {product.badge && (
          <span
            className={
              product.badge.type === 'short-expiry'
                ? 'absolute start-3 top-3 rounded-full bg-gold px-2.5 py-1 text-xs font-medium text-slate'
                : 'absolute start-3 top-3 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground'
            }
          >
            {product.badge.label}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {product.brand}
        </p>
        <h3 className="mt-1 text-pretty text-sm font-medium leading-snug text-foreground">
          <Link href={`/products/${product.slug}`} className="hover:text-primary">
            {product.name}
          </Link>
        </h3>

        <div className="mt-2">
          <StarRating rating={product.rating} reviews={product.reviews} />
        </div>

        <span className="mt-3 inline-flex w-fit items-center rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
          {product.expiry}
        </span>

        <div className="mt-auto pt-4">
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-base font-semibold text-foreground">
                  {formatEGP(product.pricePiastres)}
                </span>
                {product.oldPricePiastres && (
                  <span className="text-xs text-muted-foreground line-through">
                    {formatEGP(product.oldPricePiastres)}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Earn {formatPoints(product.points)} pts
              </p>
            </div>
            <form action={addToCartAction}>
              <input type="hidden" name="productId" value={product.id} />
              <input type="hidden" name="qty" value="1" />
              <input type="hidden" name="locale" value={locale} />
              <button
                type="submit"
                aria-label={`Add ${product.name} to cart`}
                className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border text-primary transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
              >
                <Plus className="size-4" aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </article>
  )
}
