import { MessageSquare, Wallet, Plane, ShieldCheck } from "lucide-react"
import { Button } from "@/components/storefront/ui/button"

const steps = [
  { icon: MessageSquare, title: "Tell us the product", desc: "Share a link or a name — any brand." },
  { icon: Wallet, title: "Reserve with 25% deposit", desc: "We lock your price and start sourcing." },
  { icon: Plane, title: "We buy & fly it to Egypt", desc: "Direct from the USA, UK & EU in ~20 days." },
  { icon: ShieldCheck, title: "Late? Automatic compensation", desc: "On-time delivery, guaranteed in writing." },
]

export function SpecialOrder() {
  return (
    <section className="bg-slate text-slate-foreground">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="max-w-2xl">
          <h2 className="text-balance text-2xl font-medium tracking-tight sm:text-3xl">
            Can&apos;t find it? We&apos;ll bring it.
          </h2>
          <p className="mt-3 text-pretty leading-relaxed text-slate-foreground/70">
            If it&apos;s sold abroad, we can source it for you — authentic, tracked, and on a fixed
            timeline.
          </p>
        </div>

        <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <li key={step.title} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-white/10 text-lime">
                  <step.icon className="size-4.5" aria-hidden="true" />
                </span>
                <span className="text-sm font-medium text-lime">Step {i + 1}</span>
              </div>
              <h3 className="text-base font-medium">{step.title}</h3>
              <p className="text-sm leading-relaxed text-slate-foreground/70">{step.desc}</p>
            </li>
          ))}
        </ol>

        <Button
          size="lg"
          className="mt-10 h-11 bg-lime px-6 text-lime-foreground hover:bg-lime/90"
        >
          Start a special order
        </Button>
      </div>
    </section>
  )
}
