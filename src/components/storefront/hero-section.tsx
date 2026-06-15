import Image from "next/image"
import { ArrowRight } from "lucide-react"
import { useTranslations } from "next-intl"

const cards = [
  { key: "bestsellers", cta: "shop", image: "/hero/bestsellers.png" },
  { key: "shortExpiry", cta: "shop", image: "/hero/short-expiry.png" },
  { key: "specialOrder", cta: "learnMore", image: "/hero/special-order.png" },
] as const

export function HeroSection() {
  const t = useTranslations("storefront.hero")
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
      <div className="max-w-2xl">
        <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {cards.map((card) => (
          <article
            key={card.key}
            className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-1"
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-surface">
              <Image
                src={card.image || "/placeholder.svg"}
                alt={t(`cards.${card.key}Alt`)}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            </div>
            <div className="flex flex-1 flex-col p-6">
              <h2 className="text-xl font-medium text-foreground">{t(`cards.${card.key}Title`)}</h2>
              <p className="mt-1.5 text-pretty text-sm leading-relaxed text-muted-foreground">
                {t(`cards.${card.key}Desc`)}
              </p>
              <a
                href="#"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-deep-green"
              >
                {t(card.cta)}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
