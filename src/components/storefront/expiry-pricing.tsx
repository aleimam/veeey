"use client"

import { useState } from "react"
import Image from "next/image"
import { Check } from "lucide-react"
import { formatEGP } from "@/lib/format"
import { Button } from "@/components/storefront/ui/button"

const options = [
  { expiry: "Exp 11/2026", price: 560, note: "−38%", fullShelf: false },
  { expiry: "Exp 06/2027", price: 765, note: "−15%", fullShelf: false },
  { expiry: "Exp 03/2028", price: 900, note: "Full shelf life", fullShelf: true },
]

export function ExpiryPricing() {
  const [selected, setSelected] = useState(2)

  return (
    <section className="bg-surface">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-20">
        <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card">
          <Image
            src="/products/omega-3.png"
            alt="Nordic Naturals Ultimate Omega 3 supplement bottle"
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />
        </div>

        <div>
          <h2 className="text-balance text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
            Choose your expiry, choose your price
          </h2>
          <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
            Same product, different lots. Pick the shelf life that fits your routine — and pay
            accordingly.
          </p>

          <p className="mt-6 text-sm font-medium text-foreground">
            Nordic Naturals Ultimate Omega 3
          </p>

          <fieldset className="mt-3">
            <legend className="sr-only">Select an expiry date and price</legend>
            <div className="flex flex-col gap-3">
              {options.map((option, i) => {
                const isSelected = selected === i
                return (
                  <button
                    key={option.expiry}
                    type="button"
                    onClick={() => setSelected(i)}
                    aria-pressed={isSelected}
                    className={`flex items-center justify-between gap-4 rounded-xl border bg-card px-4 py-3.5 text-left transition-all ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                          isSelected ? "border-primary bg-primary" : "border-border"
                        }`}
                      >
                        {isSelected && (
                          <Check className="size-3 text-primary-foreground" aria-hidden="true" />
                        )}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">{option.expiry}</p>
                        <p
                          className={`text-xs ${
                            option.fullShelf ? "text-primary" : "text-muted-foreground"
                          }`}
                        >
                          {option.note}
                        </p>
                      </div>
                    </div>
                    <span className="text-base font-semibold text-foreground">
                      {formatEGP(option.price)}
                    </span>
                  </button>
                )
              })}
            </div>
          </fieldset>

          <Button size="lg" className="mt-6 h-11 px-6">
            Add to cart — {formatEGP(options[selected].price)}
          </Button>
        </div>
      </div>
    </section>
  )
}
