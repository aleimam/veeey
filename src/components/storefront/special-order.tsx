import { Search, CreditCard, Globe, BadgeCheck } from "lucide-react"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import { btnClass } from "@/components/storefront/ui/button"

const steps = [
  { icon: Search, key: "tell" },
  { icon: CreditCard, key: "reserve" },
  { icon: Globe, key: "fly" },
  { icon: BadgeCheck, key: "compensation" },
] as const

export function SpecialOrder() {
  const t = useTranslations("storefront.specialOrder")
  return (
    <section style={{ background: "#2b3742" }} className="text-white">
      <div className="mx-auto max-w-[1000px] px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-20">
        <h2 className="text-4xl font-bold leading-[1.08] sm:text-[46px]">{t("title")}</h2>
        <p className="mx-auto mt-4 max-w-[540px] leading-relaxed text-white/65">{t("subtitle")}</p>

        <div className="relative mt-12">
          <div className="absolute inset-x-[12.5%] top-7 hidden h-px bg-white/15 sm:block" aria-hidden="true" />
          <ol className="relative grid gap-8 sm:grid-cols-4">
            {steps.map((step, i) => (
              <li key={step.key} className="flex flex-col items-center gap-4">
                <span
                  className="flex size-14 items-center justify-center rounded-full border-2 border-lime text-lg font-bold text-lime shadow-[0_0_14px_rgba(209,215,37,0.35)]"
                  style={{ background: "#2b3742" }}
                >
                  {i + 1}
                </span>
                <step.icon className="size-6 text-white/55" aria-hidden="true" />
                <h3 className="max-w-[160px] text-[15px] font-medium text-white">{t(`${step.key}Title`)}</h3>
                <p className="max-w-[180px] text-[13px] leading-relaxed text-white/55">{t(`${step.key}Desc`)}</p>
              </li>
            ))}
          </ol>
        </div>

        <Link href="/special-order" className={`${btnClass("primary", "lg")} mt-12`}>
          {t("cta")}
        </Link>
      </div>
    </section>
  )
}
