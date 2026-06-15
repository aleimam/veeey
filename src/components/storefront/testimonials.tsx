import { Star } from "lucide-react"
import { useTranslations } from "next-intl"

const quotes = [
  { quote: "quote1", name: "Nourhan A.", location: "loc1" },
  { quote: "quote2", name: "Karim S.", location: "loc2" },
  { quote: "quote3", name: "Mona E.", location: "loc3" },
] as const

export function Testimonials() {
  const t = useTranslations("storefront.testimonials")
  return (
    <section className="bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-balance text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
            {t("title")}
          </h2>
          <div className="flex items-center gap-2 text-sm">
            <div className="flex" aria-hidden="true">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="size-4 fill-gold text-gold" />
              ))}
            </div>
            <span className="font-medium text-foreground">4.9</span>
            <span className="text-muted-foreground">{t("ratingSuffix")}</span>
          </div>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {quotes.map((item) => (
            <figure
              key={item.name}
              className="flex flex-col rounded-2xl border border-border bg-card p-6"
            >
              <div className="flex" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-4 fill-gold text-gold" />
                ))}
              </div>
              <blockquote className="mt-4 flex-1 text-pretty text-sm leading-relaxed text-foreground">
                {t(item.quote)}
              </blockquote>
              <figcaption className="mt-5 text-sm">
                <span className="font-medium text-foreground">{item.name}</span>
                <span className="text-muted-foreground"> · {t(item.location)}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
