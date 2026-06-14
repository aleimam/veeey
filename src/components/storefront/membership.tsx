import { Check } from "lucide-react"
import { Button } from "@/components/storefront/ui/button"
import { cn } from "@/lib/utils"

const tiers = [
  {
    name: "Veeey Green",
    rate: "1 pt / EGP",
    perks: ["Points on every order", "Member-only offers", "Birthday reward"],
    dark: false,
  },
  {
    name: "VeeeyIP",
    rate: "2 pts / EGP",
    perks: ["Everything in Green", "Priority UltraFast slots", "Early access to deals"],
    dark: false,
  },
  {
    name: "Veeey Select",
    rate: "3 pts / EGP",
    perks: ["Everything in VeeeyIP", "Dedicated pharmacist", "Members-only products"],
    dark: true,
  },
]

export function Membership() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <div className="max-w-2xl">
        <h2 className="text-balance text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
          Membership that rewards label-readers
        </h2>
        <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
          Earn points on everything you buy, and unlock more the longer you stay.
        </p>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {tiers.map((tier) => (
          <div
            key={tier.name}
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
              {tier.rate}
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
                    {perk}
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
              Learn more
            </Button>
          </div>
        ))}
      </div>
    </section>
  )
}
