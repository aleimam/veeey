import { VeeeyLogo } from "@/components/storefront/veeey-logo"
import { Button } from "@/components/storefront/ui/button"
import { LanguageSwitcher } from "@/components/storefront/language-switcher"

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M14 9h3V6h-3a4 4 0 0 0-4 4v2H7v3h3v6h3v-6h3l1-3h-4v-2a1 1 0 0 1 1-1z" />
    </svg>
  )
}

function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  )
}

const columns = [
  { title: "Shop", links: ["Vitamins & supplements", "Devices", "Brands", "Offers", "Special order"] },
  { title: "Help", links: ["Track my order", "Shipping & delivery", "Returns", "Contact us", "FAQ"] },
  { title: "Policies", links: ["Authenticity guarantee", "Privacy policy", "Terms of service", "Compensation policy"] },
  { title: "About", links: ["Our story", "Our pharmacists", "Careers", "Blog"] },
]

const payments = ["OPay", "Kashier", "COD", "POS on delivery", "Bank transfer"]

export function SiteFooter() {
  return (
    <footer className="bg-slate text-slate-foreground">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_2fr]">
          <div className="max-w-sm">
            <VeeeyLogo variant="light" />
            <p className="mt-4 text-sm leading-relaxed text-slate-foreground/70">
              Premium dietary supplements and health devices, imported directly from the USA, UK and
              EU. Health Inside.
            </p>
            <form className="mt-6">
              <label htmlFor="newsletter" className="text-sm font-medium">
                Get health insights & offers
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="newsletter"
                  type="email"
                  required
                  placeholder="Your email"
                  className="h-10 w-full rounded-xl border border-white/15 bg-white/5 px-3.5 text-sm text-slate-foreground outline-none transition-colors placeholder:text-slate-foreground/50 focus:border-lime"
                />
                <Button
                  type="submit"
                  className="h-10 shrink-0 bg-lime px-4 text-lime-foreground hover:bg-lime/90"
                >
                  Subscribe
                </Button>
              </div>
            </form>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {columns.map((col) => (
              <div key={col.title}>
                <h3 className="text-sm font-medium">{col.title}</h3>
                <ul className="mt-4 flex flex-col gap-2.5 text-sm text-slate-foreground/70">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a href="#" className="transition-colors hover:text-lime">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <ul className="flex flex-wrap items-center gap-2" aria-label="Accepted payment methods">
              {payments.map((p) => (
                <li
                  key={p}
                  className="rounded-md border border-white/15 px-2.5 py-1 text-xs text-slate-foreground/80"
                >
                  {p}
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-4">
              <LanguageSwitcher className="flex items-center gap-2 text-sm" />
              <div className="flex items-center gap-1">
                <a href="#" aria-label="Instagram" className="flex size-9 items-center justify-center rounded-xl text-slate-foreground/80 transition-colors hover:bg-white/10 hover:text-lime">
                  <InstagramIcon className="size-4.5" />
                </a>
                <a href="#" aria-label="Facebook" className="flex size-9 items-center justify-center rounded-xl text-slate-foreground/80 transition-colors hover:bg-white/10 hover:text-lime">
                  <FacebookIcon className="size-4.5" />
                </a>
                <a href="#" aria-label="Twitter" className="flex size-9 items-center justify-center rounded-xl text-slate-foreground/80 transition-colors hover:bg-white/10 hover:text-lime">
                  <TwitterIcon className="size-4.5" />
                </a>
              </div>
            </div>
          </div>

          <p className="mt-8 text-xs text-slate-foreground/50">
            © {new Date().getFullYear()} Veeey. Health Inside. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
