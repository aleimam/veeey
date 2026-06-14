import { Star } from "lucide-react"

const quotes = [
  {
    quote:
      "Finally a store that shows the expiry before I pay. I ordered at 9am and the courier was at my door by lunch.",
    name: "Nourhan A.",
    location: "New Cairo",
  },
  {
    quote:
      "They special-ordered a brand I couldn't find anywhere in Egypt. Sealed, authentic, and exactly on the date they promised.",
    name: "Karim S.",
    location: "Sheikh Zayed",
  },
  {
    quote:
      "The pharmacist actually called to check the dosage was right for me. That kind of care is rare.",
    name: "Mona E.",
    location: "Maadi",
  },
]

export function Testimonials() {
  return (
    <section className="bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-balance text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
            Trusted by label-readers
          </h2>
          <div className="flex items-center gap-2 text-sm">
            <div className="flex" aria-hidden="true">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="size-4 fill-gold text-gold" />
              ))}
            </div>
            <span className="font-medium text-foreground">4.9</span>
            <span className="text-muted-foreground">on Trustpilot</span>
          </div>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {quotes.map((item) => (
            <figure
              key={item.name}
              className="flex flex-col rounded-2xl border border-border bg-card p-6"
            >
              <div className="flex" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-4 fill-gold text-gold" />
                ))}
              </div>
              <blockquote className="mt-4 flex-1 text-pretty text-sm leading-relaxed text-foreground">
                {item.quote}
              </blockquote>
              <figcaption className="mt-5 text-sm">
                <span className="font-medium text-foreground">{item.name}</span>
                <span className="text-muted-foreground"> · {item.location}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
