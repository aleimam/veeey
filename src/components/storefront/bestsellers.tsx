import { ProductCard, type Product } from '@/components/storefront/product-card'
import { Link } from '@/i18n/navigation'

export function Bestsellers({ products, locale = 'en' }: { products: Product[]; locale?: string }) {
  if (products.length === 0) return null
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-balance text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
          Bestsellers
        </h2>
        <Link
          href="/products"
          className="shrink-0 text-sm font-medium text-primary transition-colors hover:text-deep-green"
        >
          View all
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
        {products.map((product) => (
          <ProductCard key={product.slug} product={product} locale={locale} />
        ))}
      </div>
    </section>
  )
}
