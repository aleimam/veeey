import Image from "next/image"
import { ArrowRight } from "lucide-react"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"

const articles = [
  { key: "1", image: "/blog/blog-1.png" },
  { key: "2", image: "/blog/blog-2.png" },
] as const

export function BlogTeaser() {
  const t = useTranslations("storefront.blog")
  return (
    <section className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
      <div className="mb-8 flex items-end justify-between gap-4">
        <h2 className="text-3xl font-bold text-green-dark">{t("title")}</h2>
        <Link
          href="/blog"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-green-dark transition-colors hover:text-lime-press"
        >
          {t("allArticles")} <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {articles.map((article) => (
          <Link
            key={article.key}
            href="/blog"
            className="group flex flex-col overflow-hidden rounded-[16px] border border-[color:var(--green-dark-05)] bg-white shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)] sm:flex-row"
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
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-green-mid">{t("category")}</p>
              <h3 className="mt-2 text-lg font-bold leading-snug text-green-dark">{t(`title${article.key}`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[color:var(--text-muted)]">{t(`excerpt${article.key}`)}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-green-dark">
                {t("readMore")}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
