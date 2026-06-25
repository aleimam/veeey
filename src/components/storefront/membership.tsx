import { Check, ArrowRight } from "lucide-react"
import { useTranslations } from "next-intl"
import { TierBadge } from "@/components/storefront/ui/tier-badge"
import { Link } from "@/i18n/navigation"

const tiers = [
  { tier: "green", name: "Veeey Green", perks: ["greenPerk1", "greenPerk2", "greenPerk3"], rate: "greenRate", dark: false },
  { tier: "ip", name: "VeeeyIP", perks: ["ipPerk1", "ipPerk2", "ipPerk3"], rate: "ipRate", dark: false },
  { tier: "select", name: "Veeey Select", perks: ["selectPerk1", "selectPerk2", "selectPerk3"], rate: "selectRate", dark: true },
] as const

export function Membership() {
  const t = useTranslations("storefront.membership")
  return (
    <section className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
      <div className="mb-7 max-w-2xl">
        <h2 className="text-3xl font-bold text-green-dark">{t("title")}</h2>
        <p className="mt-3 leading-relaxed text-[color:var(--text-muted)]">{t("subtitle")}</p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {tiers.map((tier) => (
          <div
            key={tier.tier}
            className={`flex min-h-[210px] flex-col gap-4 rounded-[18px] border p-7 ${
              tier.dark ? "border-transparent text-white" : "border-[color:var(--green-dark-05)]"
            }`}
            style={
              tier.dark
                ? { background: "linear-gradient(150deg, var(--green-emerald), #1c4a30)" }
                : { background: "linear-gradient(150deg, #fff, var(--green-wash))" }
            }
          >
            <TierBadge tier={tier.tier} label={tier.name} />
            <span className={`text-2xl font-bold ${tier.dark ? "text-gold-wash" : "text-green-dark"}`}>{t(tier.rate)}</span>
            <ul className="flex flex-1 flex-col gap-2.5">
              {tier.perks.map((perk) => (
                <li key={perk} className={`flex items-start gap-2 text-sm ${tier.dark ? "text-white/85" : "text-[color:var(--text-muted)]"}`}>
                  <Check className={`mt-0.5 size-4 shrink-0 ${tier.dark ? "text-lime" : "text-green-dark"}`} aria-hidden="true" />
                  <span>{t(perk)}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/p/loyalty-rewards"
              className={`inline-flex items-center gap-1.5 text-[13px] font-semibold ${tier.dark ? "text-lime" : "text-green-dark"}`}
            >
              {t("learnMore")} <ArrowRight className="size-[15px]" aria-hidden="true" />
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}
