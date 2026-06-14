import { Search, User, Heart, ShoppingBag } from "lucide-react"
import { VeeeyLogo } from "@/components/veeey-logo"

const navItems = [
  "Shop by goal",
  "Vitamins & supplements",
  "Devices",
  "Brands",
  "Offers",
  "Special order",
  "Blog",
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center gap-4">
          <a href="#" aria-label="Veeey home" className="shrink-0">
            <VeeeyLogo />
          </a>

          <div className="relative hidden flex-1 md:block">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              placeholder={`Try "omega 3", "Solgar", or "energy"…`}
              aria-label="Search products"
              className="h-10 w-full rounded-xl border border-border bg-surface pl-10 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-background"
            />
          </div>

          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <button
              aria-label="Account"
              className="flex size-10 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-surface"
            >
              <User className="size-5" aria-hidden="true" />
            </button>
            <button
              aria-label="Wishlist"
              className="flex size-10 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-surface"
            >
              <Heart className="size-5" aria-hidden="true" />
            </button>
            <button
              aria-label="Cart, 2 items"
              className="relative flex size-10 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-surface"
            >
              <ShoppingBag className="size-5" aria-hidden="true" />
              <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                2
              </span>
            </button>
          </div>
        </div>

        <div className="relative pb-2 md:hidden">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder={`Try "omega 3" or "energy"…`}
            aria-label="Search products"
            className="h-10 w-full rounded-xl border border-border bg-surface pl-10 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-background"
          />
        </div>
      </div>

      <nav aria-label="Primary" className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <ul className="flex items-center gap-6 overflow-x-auto py-3 text-sm text-muted-foreground [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {navItems.map((item, i) => (
              <li key={item} className="whitespace-nowrap">
                <a
                  href="#"
                  className={
                    i === 0
                      ? "relative font-medium text-foreground after:absolute after:-bottom-3 after:left-0 after:h-0.5 after:w-full after:bg-lime"
                      : "transition-colors hover:text-foreground"
                  }
                >
                  {item}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </header>
  )
}
