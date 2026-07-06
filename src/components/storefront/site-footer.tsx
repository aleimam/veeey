import { getTranslations, getLocale } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { VeeeyLogo } from "@/components/storefront/veeey-logo"
import { SocialIcon } from "@/components/storefront/social-icon"
import { activeSocialLinks, SOCIAL_PLATFORMS } from "@/lib/social-service"
import { getAllSettings } from "@/lib/settings-service"

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
    <footer className="mt-2 border-t border-[color:var(--green-dark-05)] bg-white text-slate">
      <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_2fr]">
          <div className="max-w-sm">
            <VeeeyLogo size={30} />
            <p className="mt-4 text-sm leading-relaxed text-[color:var(--text-muted)]">{t("blurb")}</p>
            {(address || phone || email || whatsapp) && (
              <ul className="mt-6 space-y-2 text-sm text-slate">
                {address && <li>{address}</li>}
                {phone && <li><a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="transition-colors hover:text-green-dark">{phone}</a></li>}
                {whatsapp && <li><a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="transition-colors hover:text-green-dark">WhatsApp: {whatsapp}</a></li>}
                {email && <li><a href={`mailto:${email}`} className="transition-colors hover:text-green-dark">{email}</a></li>}
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
                <li key={p} className="rounded-full border border-[color:var(--slate-border)] px-3 py-1 text-xs text-[color:var(--text-muted)]">
                  {t(`pay.${p}`)}
                </li>
              ))}
            </ul>
            <p className="text-xs text-[color:var(--text-subtle)]">{t("rights", { year: new Date().getFullYear() })} · You Deserve More</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
