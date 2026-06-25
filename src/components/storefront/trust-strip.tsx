import { ShieldCheck, CalendarCheck, Truck, Zap, BadgeCheck } from "lucide-react"
import { useTranslations } from "next-intl"

const items = [
  { icon: ShieldCheck, key: "authentic" },
  { icon: CalendarCheck, key: "expiry" },
  { icon: Truck, key: "freeShipping" },
  { icon: Zap, key: "ultrafast" },
  { icon: BadgeCheck, key: "compensated" },
] as const

const circle = "flex size-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm"

export function TrustStrip({ badges }: { badges?: string[] }) {
  const t = useTranslations("storefront.trust")
  return (
    <section aria-label={t("aria")} className="border-y border-[color:var(--green-dark-12)] bg-green-wash">
      <div className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 lg:px-8">
        <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
          {badges && badges.length
            ? badges.map((label, i) => (
                <li key={i} className="flex items-center gap-2.5">
                  <span className={circle}>
                    <BadgeCheck className="size-[18px] text-green-dark" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-semibold text-green-dark">{label}</span>
                </li>
              ))
            : items.map((item) => (
                <li key={item.key} className="flex items-center gap-2.5">
                  <span className={circle}>
                    <item.icon className="size-[18px] text-green-dark" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-semibold text-green-dark">{t(item.key)}</span>
                </li>
              ))}
        </ul>
      </div>
    </section>
  )
}
