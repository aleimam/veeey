import { MessageSquare, Wallet, Plane, ShieldCheck } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/storefront/ui/button"

const steps = [
  { icon: MessageSquare, key: "tell" },
  { icon: Wallet, key: "reserve" },
  { icon: Plane, key: "fly" },
  { icon: ShieldCheck, key: "compensation" },
] as const

export function SpecialOrder() {
  const t = useTranslations("storefront.specialOrder")
  return (
    <section className="bg-slate text-slate-foreground">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="max-w-2xl">
          <h2 className="text-balance text-2xl font-medium tracking-tight sm:text-3xl">
            {t("title")}
          </h2>
          <p className="mt-3 text-pretty leading-relaxed text-slate-foreground/70">
            {t("subtitle")}
          </p>
        </div>

        <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <li key={step.key} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-white/10 text-lime">
                  <step.icon className="size-4.5" aria-hidden="true" />
                </span>
                <span className="text-sm font-medium text-lime">{t("step", { n: i + 1 })}</span>
              </div>
              <h3 className="text-base font-medium">{t(`${step.key}Title`)}</h3>
              <p className="text-sm leading-relaxed text-slate-foreground/70">{t(`${step.key}Desc`)}</p>
            </li>
          ))}
        </ol>

        <Button
          size="lg"
          className="mt-10 h-11 bg-lime px-6 text-lime-foreground hover:bg-lime/90"
        >
          {t("cta")}
        </Button>
      </div>
    </section>
  )
}
