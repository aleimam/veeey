import { Shield, Zap, Brain, Moon, HeartPulse, Activity } from "lucide-react"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"

const goals = [
  { key: "immunity", icon: Shield, href: "/products" },
  { key: "energy", icon: Zap, href: "/products" },
  { key: "brain", icon: Brain, href: "/products" },
  { key: "sleep", icon: Moon, href: "/products" },
  { key: "heart", icon: HeartPulse, href: "/products" },
  { key: "devices", icon: Activity, href: "/products?kind=DEVICE" },
] as const

export function ShopByGoal() {
  const t = useTranslations("storefront.goals")
  return (
    <section className="mx-auto max-w-[1280px] px-4 py-12 sm:px-6 lg:px-8 lg:py-14">
      <h2 className="mb-7 text-3xl font-bold text-green-dark">{t("title")}</h2>
      <ul className="grid grid-cols-3 gap-3.5 sm:grid-cols-6">
        {goals.map((goal) => (
          <li key={goal.key}>
            <Link
              href={goal.href}
              className="group flex flex-col items-center gap-2.5 rounded-[14px] border border-[color:var(--slate-border)] bg-white px-2 py-5 text-center transition-all hover:border-green-dark hover:shadow-sm"
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-green-wash">
                <goal.icon className="size-[22px] text-green-dark" aria-hidden="true" />
              </span>
              <span className="text-[13px] font-semibold text-slate">{t(goal.key)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
