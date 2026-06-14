import { ShieldCheck, CalendarCheck, Truck, Zap, BadgeCheck } from "lucide-react"

const items = [
  { icon: ShieldCheck, label: "Authentic imports" },
  { icon: CalendarCheck, label: "Expiry shown on every item" },
  { icon: Truck, label: "Free shipping" },
  { icon: Zap, label: "UltraFast 3–6h" },
  { icon: BadgeCheck, label: "On-time or compensated" },
]

export function TrustStrip() {
  return (
    <section aria-label="Why shop with Veeey" className="border-y border-border bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
          {items.map((item) => (
            <li key={item.label} className="flex items-center gap-2">
              <item.icon className="size-4 text-primary" aria-hidden="true" />
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
