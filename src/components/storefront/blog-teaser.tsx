import Image from "next/image"
import { ArrowRight } from "lucide-react"

const articles = [
  {
    category: "Medical insights",
    title: "How to read a supplement label like a pharmacist",
    excerpt: "Dosage, bioavailability, and the fine print that actually matters.",
    image: "/blog/blog-1.png",
  },
  {
    category: "Medical insights",
    title: "Does expiry date really change a supplement's potency?",
    excerpt: "What shelf life means for vitamins, omegas, and minerals.",
    image: "/blog/blog-2.png",
  },
]

export function BlogTeaser() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-balance text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
          Medical insights from our pharmacists
        </h2>
        <a
          href="#"
          className="shrink-0 text-sm font-medium text-primary transition-colors hover:text-deep-green"
        >
          All articles
        </a>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {articles.map((article) => (
          <a
            key={article.title}
            href="#"
            className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 sm:flex-row"
          >
            <div className="relative aspect-[16/10] overflow-hidden bg-surface sm:aspect-auto sm:w-2/5">
              <Image
                src={article.image || "/placeholder.svg"}
                alt={article.title}
                fill
                sizes="(max-width: 768px) 100vw, 20vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <div className="flex flex-1 flex-col p-6">
              <p className="text-xs font-medium uppercase tracking-wide text-primary">
                {article.category}
              </p>
              <h3 className="mt-2 text-pretty text-lg font-medium leading-snug text-foreground">
                {article.title}
              </h3>
              <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
                {article.excerpt}
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                Read more
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </span>
            </div>
          </a>
        ))}
      </div>
    </section>
  )
}
