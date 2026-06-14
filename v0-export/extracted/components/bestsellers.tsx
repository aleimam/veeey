import { ProductCard, type Product } from "@/components/product-card"

const products: Product[] = [
  {
    brand: "Nordic Naturals",
    name: "Ultimate Omega 3 · 1,280 mg",
    image: "/products/omega-3.png",
    rating: 4.9,
    reviews: 412,
    expiry: "Exp 05/2028",
    price: 1450,
    points: 2900,
  },
  {
    brand: "Solgar",
    name: "Vitamin D3 5,000 IU · 120 softgels",
    image: "/products/vitamin-d3.png",
    rating: 4.8,
    reviews: 318,
    expiry: "Exp 09/2026",
    price: 595,
    oldPrice: 850,
    points: 1190,
    badge: { type: "short-expiry", label: "Short expiry −30%" },
  },
  {
    brand: "Doctor's Best",
    name: "Magnesium Glycinate · 240 tablets",
    image: "/products/magnesium.png",
    rating: 4.7,
    reviews: 206,
    expiry: "Exp 11/2027",
    price: 980,
    points: 1960,
  },
  {
    brand: "Withings",
    name: "BPM Connect smart blood pressure monitor",
    image: "/products/bp-monitor.png",
    rating: 4.8,
    reviews: 154,
    expiry: "Pre-order",
    price: 5200,
    points: 10400,
    badge: { type: "pre-order", label: "Pre-order · ~20 days · 25% deposit" },
  },
]

export function Bestsellers() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-balance text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
          Bestsellers
        </h2>
        <a
          href="#"
          className="shrink-0 text-sm font-medium text-primary transition-colors hover:text-deep-green"
        >
          View all
        </a>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
        {products.map((product) => (
          <ProductCard key={product.name} product={product} />
        ))}
      </div>
    </section>
  )
}
