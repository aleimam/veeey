import { ProductCard, type Product } from '@/components/storefront/product-card';

/** A titled grid of products — used for personalized homepage/PDP recommendation
 *  rows (FR-PERS-02/05). Renders nothing when empty. */
export function ProductRow({ title, products, locale }: { title: string; products: Product[]; locale?: string }) {
  if (products.length === 0) return null;
  return (
    <section className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8">
      <h2 className="mb-6 text-2xl font-bold text-green-dark">{title}</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
        {products.map((p) => (
          <ProductCard key={p.slug} product={p} locale={locale} />
        ))}
      </div>
    </section>
  );
}
