import { ArrowRight } from "lucide-react"
import { useTranslations } from "next-intl"
import { ProductCard, type Product } from "@/components/storefront/product-card"
import { Link } from "@/i18n/navigation"

export function Bestsellers({ products, locale = "en" }: { products: Product[]; locale?: string }) {
  const t = useTranslations("storefront.bestsellers")
  if (products.length === 0) return null
  return (
    <section className="border-y border-[color:var(--green-dark-05)] bg-surface">
      <div className="mx-auto max-w-[1280px] px-4 py-12 sm:px-6 lg:px-8 lg:py-14">
        <div className="mb-7 flex items-end justify-between gap-4">
          <h2 className="text-3xl font-bold text-green-dark">{t("title")}</h2>
          <Link
            href="/products"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-green-dark transition-colors hover:text-lime-press"
          >
            {t("viewAll")} <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
          {products.map((product) => (
            <ProductCard key={product.slug} product={product} locale={locale} />
          ))}
        </div>
      </div>
    </section>
  )
}
