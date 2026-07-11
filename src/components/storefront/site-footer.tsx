import { getTranslations, getLocale } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { VeeeyLogo } from "@/components/storefront/veeey-logo"
import { SocialIcon } from "@/components/storefront/social-icon"
import { activeSocialLinks, SOCIAL_PLATFORMS } from "@/lib/social-service"
import { getAllSettings } from "@/lib/settings-service"
import { getBranding } from "@/lib/branding-service"
import { brandingSiteName } from "@/lib/branding"

const columns = [
  { key: "shop", links: ["vitamins", "devices", "refill", "select", "brands", "offers", "specialOrder"] },
  { key: "help", links: ["howToOrder", "track", "shipping", "payment", "returns", "contact", "faq"] },
  { key: "policies", links: ["authenticity", "privacy", "terms", "compensation", "cookies"] },
  { key: "about", links: ["story", "pharmacists", "learn", "rewards", "wholesale", "careers", "blog"] },
]

// Footer link → destination. CMS info pages live at /p/<slug>; functional ones
// route to real pages.
const HREFS: Record<string, string> = {
  "shop.vitamins": "/products?kind=SUPPLEMENT",
  "shop.devices": "/products?kind=DEVICE",
  "shop.brands": "/brands",
  "shop.offers": "/products?offers=1",
  "shop.specialOrder": "/special-order",
  "shop.refill": "/refill",
  "shop.select": "/select",
  "help.howToOrder": "/p/how-to-order",
  "help.track": "/p/track-order",
  "help.shipping": "/p/shipping-delivery",
  "help.payment": "/p/payment-methods",
  "help.returns": "/p/returns",
  "help.contact": "/p/contact",
  "help.faq": "/p/faq",
  "policies.authenticity": "/p/authenticity-guarantee",
  "policies.privacy": "/p/privacy-policy",
  "policies.terms": "/p/terms-of-service",
  "policies.compensation": "/p/compensation-policy",
  "policies.cookies": "/p/cookie-policy",
  "about.story": "/p/about",
  "about.pharmacists": "/p/our-pharmacists",
  "about.learn": "/learn",
  "about.rewards": "/p/loyalty-rewards",
  "about.wholesale": "/p/wholesale",
  "about.careers": "/p/careers",
  "about.blog": "/blog",
}

const payments = ["card", "cod", "pos", "bank"]
const platformLabel = (p: string) => SOCIAL_PLATFORMS.find((x) => x.value === p)?.label ?? p

/** Recognisable payment marks (audit P3): Visa/Mastercard chips + icon pills
 *  for COD / POS / bank transfer, replacing plain text pills. */
function PaymentMark({ kind, label }: { kind: string; label: string }) {
  if (kind === "card") {
    return (
      <li className="flex items-center gap-1.5" aria-label={label} title={label}>
        <span className="flex h-7 items-center rounded-[6px] border border-[color:var(--slate-border)] bg-white px-2 text-[13px] font-extrabold italic tracking-tight text-[#1a1f71]">VISA</span>
        <span className="flex h-7 items-center rounded-[6px] border border-[color:var(--slate-border)] bg-white px-2" aria-hidden="true">
          <span className="relative flex items-center">
            <span className="size-4 rounded-full bg-[#eb001b]" />
            <span className="-ms-1.5 size-4 rounded-full bg-[#f79e1b] opacity-90" />
          </span>
        </span>
      </li>
    )
  }
  const icon =
    kind === "cod" ? (
      // banknote
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></svg>
    ) : kind === "pos" ? (
      // card terminal
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M9 6h6M9 18h6" /></svg>
    ) : (
      // bank
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4" aria-hidden="true"><path d="M3 21h18M4 10h16M12 3l9 7H3l9-7ZM6 10v11M10 10v11M14 10v11M18 10v11" /></svg>
    )
  return (
    <li className="flex h-7 items-center gap-1.5 rounded-[6px] border border-[color:var(--slate-border)] bg-white px-2 text-xs font-medium text-slate">
      {icon}
      {label}
    </li>
  )
}

export async function SiteFooter() {
  const t = await getTranslations("storefront.footer")
  const locale = await getLocale()
  const social = await activeSocialLinks()
  const settings = await getAllSettings()
  const branding = await getBranding()
  const address = (locale === "ar" ? settings["store.addressAr"] : settings["store.addressEn"]) || settings["store.addressEn"] || ""
  const phone = settings["store.phone"] || ""
  const email = settings["store.contactEmail"] || ""
  const whatsapp = settings["store.whatsappNumber"] || ""
  return (
    <footer className="mt-2 border-t border-[color:var(--green-dark-05)] bg-white text-slate">
      <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_2fr]">
          <div className="max-w-sm">
            <VeeeyLogo size={30} src={branding.logoUrl || undefined} alt={brandingSiteName(branding, locale)} />
            <p className="mt-4 text-sm leading-relaxed text-[color:var(--text-muted)]">{t("blurb")}</p>
            {(address || phone || email || whatsapp) && (
              <ul className="mt-6 space-y-2.5 text-sm text-slate">
                {address && (
                  <li className="flex items-start gap-2.5">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 size-[18px] shrink-0 text-green-dark" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                    <span>{address}</span>
                  </li>
                )}
                {phone && (
                  <li className="flex items-center gap-2.5">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-[18px] shrink-0 text-green-dark" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                    <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} aria-label={`${t("callLabel")} ${phone}`} className="transition-colors hover:text-green-dark">{phone}</a>
                  </li>
                )}
                {whatsapp && (
                  <li className="flex items-center gap-2.5">
                    <SocialIcon platform="whatsapp" className="size-[18px] shrink-0 text-[#25D366]" />
                    <a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${whatsapp}`} className="transition-colors hover:text-green-dark">{whatsapp}</a>
                  </li>
                )}
                {email && (
                  <li className="flex items-center gap-2.5">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-[18px] shrink-0 text-green-dark" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 5L2 7" /></svg>
                    <a href={`mailto:${email}`} aria-label={`${t("emailLabel")} ${email}`} className="transition-colors hover:text-green-dark">{email}</a>
                  </li>
                )}
              </ul>
            )}
            {social.length > 0 && (
              <div className="mt-5 flex items-center gap-2.5">
                {social.map((s) => (
                  <a
                    key={s.id}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={s.label || platformLabel(s.platform)}
                    className="flex size-9 items-center justify-center rounded-full bg-green-wash text-green-dark transition-colors hover:bg-green-dark hover:text-white"
                  >
                    <SocialIcon platform={s.platform} className="size-[18px]" />
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {columns.map((col) => (
              <div key={col.key}>
                <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-green-dark">{t(`cols.${col.key}`)}</h3>
                <ul className="mt-4 flex flex-col gap-2.5 text-sm text-slate">
                  {col.links.map((link) => (
                    <li key={link}>
                      <Link href={HREFS[`${col.key}.${link}`] ?? "#"} className="transition-colors hover:text-green-dark">
                        {t(`${col.key}.${link}`)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 border-t border-[color:var(--slate-border)] pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <ul className="flex flex-wrap items-center gap-2" aria-label={t("paymentMethods")}>
              {payments.map((p) => (
                <PaymentMark key={p} kind={p} label={t(`pay.${p}`)} />
              ))}
            </ul>
            <p className="text-xs text-[color:var(--text-subtle)]">{t("rights", { year: new Date().getFullYear() })} · You Deserve More</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
