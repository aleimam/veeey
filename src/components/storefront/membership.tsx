import { Check } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/storefront/ui/button"
import { cn } from "@/lib/utils"

const tiers = [
  { key: "green", name: "Veeey Green", perks: ["greenPerk1", "greenPerk2", "greenPerk3"], rate: "greenRate", dark: false },
  { key: "ip", name: "VeeeyIP", perks: ["ipPerk1", "ipPerk2", "ipPerk3"], rate: "ipRate", dark: false },
  { key: "select", name: "Veeey Select", perks: ["selectPerk1", "selectPerk2", "selectPerk3"], rate: "selectRate", dark: true },
] as const

export function Membership() {
  const t = useTranslations("storefront.membership")
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <div className="max-w-2xl">
        <h2 className="text-balance text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
          {t("title")}
        </h2>
        <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {tiers.map((tier) => (
          <div
            key={tier.key}
            className={cn(
              "flex flex-col rounded-2xl border p-6",
              tier.dark
                ? "border-slate bg-slate text-slate-foreground"
                : "border-border bg-card text-foreground",
            )}
          >
            <h3 className="text-lg font-medium">{tier.name}</h3>
            <p
              className={cn(
                "mt-1 text-2xl font-semibold",
                tier.dark ? "text-lime" : "text-primary",
              )}
            >
              {t(tier.rate)}
            </p>
            <ul className="mt-5 flex flex-1 flex-col gap-3">
              {tier.perks.map((perk) => (
                <li key={perk} className="flex items-start gap-2.5 text-sm">
                  <Check
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      tier.dark ? "text-lime" : "text-primary",
                    )}
                    aria-hidden="true"
                  />
                  <span className={tier.dark ? "text-slate-foreground/80" : "text-muted-foreground"}>
                    {t(perk)}
                  </span>
                </li>
              ))}
            </ul>
            <Button
              variant={tier.dark ? "default" : "outline"}
              size="lg"
              className={cn(
                "mt-6 h-10",
                tier.dark && "bg-lime text-lime-foreground hover:bg-lime/90",
              )}
            >
              {t("learnMore")}
            </Button>
          </div>
        ))}
      </div>
    </section>
  )
}
