import { getTranslations, getLocale } from "next-intl/server"
import { Mail, Phone, MapPin } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { VeeeyLogo } from "@/components/storefront/veeey-logo"
import { LanguageSwitcher } from "@/components/storefront/language-switcher"
import { SocialIcon } from "@/components/storefront/social-icon"
import { activeSocialLinks, SOCIAL_PLATFORMS } from "@/lib/social-service"
import { getAllSettings } from "@/lib/settings-service"

const columns = [
  { key: "shop", links: ["vitamins", "devices", "brands", "offers", "specialOrder"] },
  { key: "help", links: ["howToOrder", "track", "shipping", "payment", "returns", "contact", "faq"] },
  { key: "policies", links: ["authenticity", "privacy", "terms", "compensation", "cookies"] },
  { key: "about", links: ["story", "pharmacists", "rewards", "wholesale", "careers", "blog"] },
]

// Footer link → destination. CMS info pages live at /p/<slug>; functional ones
// route to real pages. (Shop column gets real category links in a later pass.)
const HREFS: Record<string, string> = {
  "shop.vitamins": "/products?kind=SUPPLEMENT",
  "shop.devices": "/products?kind=DEVICE",
  "shop.brands": "/products",
  "shop.offers": "/products?offers=1",
  "shop.specialOrder": "/special-order",
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
  "about.rewards": "/p/loyalty-rewards",
  "about.wholesale": "/p/wholesale",
  "about.careers": "/p/careers",
  "about.blog": "/blog",
}

const payments = ["card", "cod", "pos", "bank"]
const platformLabel = (p: string) => SOCIAL_PLATFORMS.find((x) => x.value === p)?.label ?? p

export async function SiteFooter() {
  const t = await getTranslations("storefront.footer")
  const locale = await getLocale()
  const social = await activeSocialLinks()
  const settings = await getAllSettings()
  const address = (locale === "ar" ? settings["store.addressAr"] : settings["store.addressEn"]) || settings["store.addressEn"] || ""
  const phone = settings["store.phone"] || ""
  const email = settings["store.contactEmail"] || ""
  const whatsapp = settings["store.whatsappNumber"] || ""
  return (
    <footer className="bg-green-dark text-white/85">
      <div className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_2fr]">
          <div className="max-w-sm">
            <VeeeyLogo variant="light" size={32} />
            <p className="mt-4 text-sm leading-relaxed text-white/70">{t("blurb")}</p>
            {(address || phone || email || whatsapp) && (
              <ul className="mt-6 space-y-2 text-sm text-white/80">
                {address && (
                  <li className="flex items-start gap-2.5">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-lime" aria-hidden="true" />
                    <span>{address}</span>
                  </li>
                )}
                {phone && (
                  <li>
                    <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-2.5 transition-colors hover:text-lime">
                      <Phone className="size-4 shrink-0 text-lime" aria-hidden="true" />
                      {phone}
                    </a>
                  </li>
                )}
                {whatsapp && (
                  <li>
                    <a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="transition-colors hover:text-lime">
                      WhatsApp: {whatsapp}
                    </a>
                  </li>
                )}
                {email && (
                  <li>
                    <a href={`mailto:${email}`} className="flex items-center gap-2.5 transition-colors hover:text-lime">
                      <Mail className="size-4 shrink-0 text-lime" aria-hidden="true" />
                      {email}
                    </a>
                  </li>
                )}
              </ul>
            )}
            <form className="mt-6">
              <label htmlFor="newsletter" className="text-sm font-medium text-white">
                {t("newsletterLabel")}
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="newsletter"
                  type="email"
                  required
                  placeholder={t("emailPlaceholder")}
                  className="h-11 w-full rounded-full border border-white/15 bg-white/5 px-4 text-sm text-white outline-none transition-colors placeholder:text-white/40 focus:border-lime"
                />
                <button
                  type="submit"
                  className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-lime px-5 text-sm font-semibold text-green-dark transition-colors hover:bg-lime-hover"
                >
                  {t("subscribe")}
                </button>
              </div>
            </form>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {columns.map((col) => (
              <div key={col.key}>
                <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-lime">{t(`cols.${col.key}`)}</h3>
                <ul className="mt-4 flex flex-col gap-2.5 text-sm text-white/80">
                  {col.links.map((link) => (
                    <li key={link}>
                      <Link href={HREFS[`${col.key}.${link}`] ?? "#"} className="transition-colors hover:text-lime">
                        {t(`${col.key}.${link}`)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <ul className="flex flex-wrap items-center gap-2" aria-label={t("paymentMethods")}>
              {payments.map((p) => (
                <li key={p} className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/80">
                  {t(`pay.${p}`)}
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-4">
              <LanguageSwitcher className="flex items-center gap-2 text-sm" />
              {social.length > 0 && (
                <div className="flex items-center gap-1">
                  {social.map((s) => (
                    <a
                      key={s.id}
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={s.label || platformLabel(s.platform)}
                      className="flex size-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-lime"
                    >
                      <SocialIcon platform={s.platform} className="size-[18px]" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          <p className="mt-8 text-xs text-white/50">{t("rights", { year: new Date().getFullYear() })}</p>
        </div>
      </div>
    </footer>
  )
}
