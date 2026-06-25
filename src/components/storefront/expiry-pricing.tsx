"use client"

import { useState } from "react"
import Image from "next/image"
import { Check, ShoppingCart } from "lucide-react"
import { useTranslations } from "next-intl"
import { formatEGP } from "@/lib/format"
import { Chip } from "@/components/storefront/ui/chip"

const basePrice = 900
const options = [
  { date: "11/2026", price: 560, pct: 38, fullShelf: false },
  { date: "06/2027", price: 765, pct: 15, fullShelf: false },
  { date: "03/2028", price: 900, pct: 0, fullShelf: true },
]

export function ExpiryPricing() {
  const t = useTranslations("storefront.expiryPricing")
  const [selected, setSelected] = useState(0)
  const cur = options[selected]

  return (
    <section className="border-y border-[color:var(--green-dark-05)] bg-surface">
      <div className="mx-auto grid max-w-[1280px] items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-16">
        <div>
          <h2 className="text-3xl font-bold leading-[1.12] text-green-dark sm:text-[38px]">{t("title")}</h2>
          <p className="mt-4 max-w-[420px] leading-relaxed text-[color:var(--text-muted)]">{t("subtitle")}</p>
          <p className="mt-6 text-sm font-semibold text-ink">{t("productName")}</p>

          <fieldset className="mt-3">
            <legend className="sr-only">{t("legend")}</legend>
            <div className="flex flex-col gap-3">
              {options.map((option, i) => {
                const isSelected = selected === i
                return (
                  <button
                    key={option.date}
                    type="button"
                    onClick={() => setSelected(i)}
                    aria-pressed={isSelected}
                    className={`flex items-center justify-between gap-4 rounded-[14px] px-5 py-4 text-start transition-all ${
                      isSelected ? "border-[1.5px] border-green-dark bg-green-wash" : "border border-[color:var(--slate-border)] bg-white"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-[15px] font-semibold text-ink">{t("exp", { date: option.date })}</span>
                        {option.fullShelf ? (
                          <span className="text-xs text-[color:var(--text-subtle)]">{t("fullShelf")}</span>
                        ) : (
                          <Chip variant="sale">−{option.pct}%</Chip>
                        )}
                      </div>
                      <div className="mt-1.5">
                        <span className={`text-[22px] font-bold ${isSelected ? "text-green-dark" : "text-ink"}`}>{formatEGP(option.price)}</span>
                        {!option.fullShelf && (
                          <span className="ms-2 text-sm text-[color:var(--text-subtle)] line-through">{formatEGP(basePrice)}</span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`flex size-[26px] shrink-0 items-center justify-center rounded-full ${
                        isSelected ? "bg-green-dark" : "border-2 border-[color:var(--slate-border)]"
                      }`}
                    >
                      {isSelected && <Check className="size-[15px] text-white" strokeWidth={3} aria-hidden="true" />}
                    </span>
                  </button>
                )
              })}
            </div>
          </fieldset>

          <button type="button" className="v-btn v-btn--dark mt-6">
            <span className="v-btn__icon" aria-hidden="true">
              <ShoppingCart className="size-full" />
            </span>
            {t("addToCart", { price: formatEGP(cur.price) })}
          </button>
        </div>

        <div className="relative">
          <div className="relative rounded-3xl bg-white p-7 shadow-[var(--shadow-md)]">
            <div className="absolute end-5 top-5 z-10 rounded-full bg-white px-3.5 py-1.5 text-[13px] font-semibold text-green-dark shadow-sm">
              {t("exp", { date: cur.date })}
            </div>
            <div className="flex aspect-square items-center justify-center rounded-2xl bg-gradient-to-br from-white to-surface">
              <Image src="/products/marine-collagen.png" alt={t("productAlt")} width={360} height={360} className="h-[82%] w-[82%] object-contain" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
