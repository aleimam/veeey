import Image from "next/image"
import { ArrowRight } from "lucide-react"
import { useTranslations } from "next-intl"

const articles = [
  { key: "1", image: "/blog/blog-1.png" },
  { key: "2", image: "/blog/blog-2.png" },
] as const

export function BlogTeaser() {
  const t = useTranslations("storefront.blog")
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-balance text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
          {t("title")}
        </h2>
        <a
          href="#"
          className="shrink-0 text-sm font-medium text-primary transition-colors hover:text-deep-green"
        >
          {t("allArticles")}
        </a>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {articles.map((article) => (
          <a
            key={article.key}
            href="#"
            className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 sm:flex-row"
          >
            <div className="relative aspect-[16/10] overflow-hidden bg-surface sm:aspect-auto sm:w-2/5">
              <Image
                src={article.image || "/placeholder.svg"}
                alt={t(`title${article.key}`)}
                fill
                sizes="(max-width: 768px) 100vw, 20vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <div className="flex flex-1 flex-col p-6">
              <p className="text-xs font-medium uppercase tracking-wide text-primary">
                {t("category")}
              </p>
              <h3 className="mt-2 text-pretty text-lg font-medium leading-snug text-foreground">
                {t(`title${article.key}`)}
              </h3>
              <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
                {t(`excerpt${article.key}`)}
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                {t("readMore")}
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
