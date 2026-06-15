import { ShieldCheck, CalendarCheck, Truck, Zap, BadgeCheck } from "lucide-react"
import { useTranslations } from "next-intl"

const items = [
  { icon: ShieldCheck, key: "authentic" },
  { icon: CalendarCheck, key: "expiry" },
  { icon: Truck, key: "freeShipping" },
  { icon: Zap, key: "ultrafast" },
  { icon: BadgeCheck, key: "compensated" },
] as const

export function TrustStrip({ badges }: { badges?: string[] }) {
  const t = useTranslations("storefront.trust")
  return (
    <section aria-label={t("aria")} className="border-y border-border bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
          {badges && badges.length
            ? badges.map((label, i) => (
                <li key={i} className="flex items-center gap-2">
                  <BadgeCheck className="size-4 text-primary" aria-hidden="true" />
                  <span>{label}</span>
                </li>
              ))
            : items.map((item) => (
                <li key={item.key} className="flex items-center gap-2">
                  <item.icon className="size-4 text-primary" aria-hidden="true" />
                  <span>{t(item.key)}</span>
                </li>
              ))}
        </ul>
      </div>
    </section>
  )
}
