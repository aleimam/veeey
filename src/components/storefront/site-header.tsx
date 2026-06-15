import { Search, User, Heart, ShoppingBag } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { VeeeyLogo } from '@/components/storefront/veeey-logo'
import { Link } from '@/i18n/navigation'

const navItems: { key: string; href: string }[] = [
  { key: 'shopByGoal', href: '/products' },
  { key: 'vitamins', href: '/products?kind=SUPPLEMENT' },
  { key: 'devices', href: '/products?kind=DEVICE' },
  { key: 'brands', href: '/products' },
  { key: 'offers', href: '/products?offers=1' },
  { key: 'specialOrder', href: '/p/special-order' },
  { key: 'play', href: '/play' },
  { key: 'blog', href: '/blog' },
]

function SearchBox({ locale, placeholder, ariaLabel }: { locale: string; placeholder: string; ariaLabel: string }) {
  return (
    <form action={`/${locale}/search`} className="relative w-full">
      <Search
        className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        type="search"
        name="q"
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="h-10 w-full rounded-xl border border-border bg-surface ps-10 pe-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-background"
      />
    </form>
  )
}

export function SiteHeader({ locale, cartCount = 0 }: { locale: string; cartCount?: number }) {
  const t = useTranslations('storefront.header')
  const tNav = useTranslations('storefront.nav')
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center gap-4">
          <Link href="/" aria-label={t('home')} className="shrink-0">
            <VeeeyLogo />
          </Link>

          <div className="relative hidden flex-1 md:block">
            <SearchBox locale={locale} placeholder={t('searchPlaceholder')} ariaLabel={t('searchAria')} />
          </div>

          <div className="ms-auto flex items-center gap-1 md:ms-0">
            <Link href="/account" aria-label={t('account')} className="flex size-10 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-surface">
              <User className="size-5" aria-hidden="true" />
            </Link>
            <Link href="/wishlist" aria-label={t('wishlist')} className="flex size-10 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-surface">
              <Heart className="size-5" aria-hidden="true" />
            </Link>
            <Link href="/cart" aria-label={t('cart')} className="relative flex size-10 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-surface">
              <ShoppingBag className="size-5" aria-hidden="true" />
              {cartCount > 0 && (
                <span className="absolute end-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        <div className="relative pb-2 md:hidden">
          <SearchBox locale={locale} placeholder={t('searchPlaceholderShort')} ariaLabel={t('searchAria')} />
        </div>
      </div>

      <nav aria-label="Primary" className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <ul className="flex items-center gap-6 overflow-x-auto py-3 text-sm text-muted-foreground [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {navItems.map((item, i) => (
              <li key={item.key} className="whitespace-nowrap">
                <Link
                  href={item.href}
                  className={
                    i === 0
                      ? 'relative font-medium text-foreground after:absolute after:-bottom-3 after:start-0 after:h-0.5 after:w-full after:bg-lime'
                      : 'transition-colors hover:text-foreground'
                  }
                >
                  {tNav(item.key)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </header>
  )
}
