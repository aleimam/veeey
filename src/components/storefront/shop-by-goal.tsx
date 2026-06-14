import Image from "next/image"
import { Link } from "@/i18n/navigation"

const goals = [
  { label: "Immunity", image: "/goals/immunity.png" },
  { label: "Energy", image: "/goals/energy.png" },
  { label: "Brain & focus", image: "/goals/brain.png" },
  { label: "Sleep", image: "/goals/sleep.png" },
  { label: "Heart", image: "/goals/heart.png" },
  { label: "Devices", image: "/goals/devices.png" },
]

export function ShopByGoal() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <h2 className="text-balance text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
        Shop by health goal
      </h2>
      <ul className="mt-8 grid grid-cols-3 gap-x-4 gap-y-8 sm:grid-cols-6">
        {goals.map((goal) => (
          <li key={goal.label}>
            <Link href="/products" className="group flex flex-col items-center gap-3 text-center">
              <span className="relative aspect-square w-full overflow-hidden rounded-full border border-border bg-surface transition-all duration-300 group-hover:-translate-y-1 group-hover:border-primary/40">
                <Image
                  src={goal.image || "/placeholder.svg"}
                  alt={goal.label}
                  fill
                  sizes="(max-width: 640px) 30vw, 12vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </span>
              <span className="text-sm font-medium text-foreground">{goal.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
