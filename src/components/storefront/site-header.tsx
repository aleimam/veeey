import { Search, User, Heart, ShoppingBag, LayoutDashboard } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { VeeeyLogo } from '@/components/storefront/veeey-logo'
import { Badge } from '@/components/storefront/ui/badge'
import { Link } from '@/i18n/navigation'

const navItems: { key: string; href: string }[] = [
  { key: 'shopByGoal', href: '/products' },
  { key: 'vitamins', href: '/products?kind=SUPPLEMENT' },
  { key: 'devices', href: '/products?kind=DEVICE' },
  { key: 'brands', href: '/products' },
  { key: 'offers', href: '/products?offers=1' },
  { key: 'specialOrder', href: '/special-order' },
  { key: 'play', href: '/play' },
  { key: 'blog', href: '/blog' },
]

function SearchBox({ locale, placeholder, ariaLabel }: { locale: string; placeholder: string; ariaLabel: string }) {
  return (
    <form
      action={`/${locale}/search`}
      className="flex h-11 w-full items-center gap-2.5 rounded-full border border-[color:var(--slate-border)] bg-surface px-4 transition-colors focus-within:border-lime focus-within:bg-white"
    >
      <Search className="pointer-events-none size-[18px] shrink-0 text-slate-70" aria-hidden="true" />
      <input
        type="search"
        name="q"
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="w-full bg-transparent text-sm text-slate outline-none placeholder:text-slate-45"
      />
    </form>
  )
}

export function SiteHeader({ locale, cartCount = 0, isStaff = false }: { locale: string; cartCount?: number; isStaff?: boolean }) {
  const t = useTranslations('storefront.header')
  const tNav = useTranslations('storefront.nav')
  const iconLink = 'flex size-10 items-center justify-center rounded-full text-slate transition-colors hover:bg-surface'
  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--slate-border)] bg-white">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center gap-4">
          <Link href="/" aria-label={t('home')} className="shrink-0">
            <VeeeyLogo priority size={30} />
          </Link>

          <div className="hidden flex-1 justify-center md:flex">
            <div className="w-full max-w-[420px]">
              <SearchBox locale={locale} placeholder={t('searchPlaceholder')} ariaLabel={t('searchAria')} />
            </div>
          </div>

          <div className="ms-auto flex items-center gap-1 md:ms-0">
            {isStaff && (
              <Link
                href="/admin"
                aria-label={t('admin')}
                title={t('admin')}
                className="flex size-10 items-center justify-center rounded-full text-green-dark transition-colors hover:bg-surface"
              >
                <LayoutDashboard className="size-5" aria-hidden="true" />
              </Link>
            )}
            <Link href="/account" aria-label={t('account')} className={iconLink}>
              <User className="size-5" aria-hidden="true" />
            </Link>
            <Link href="/wishlist" aria-label={t('wishlist')} className={iconLink}>
              <Heart className="size-5" aria-hidden="true" />
            </Link>
            <Link href="/cart" aria-label={t('cart')} className={`relative ${iconLink}`}>
              <ShoppingBag className="size-5" aria-hidden="true" />
              {cartCount > 0 && (
                <span className="absolute end-0.5 top-0.5">
                  <Badge variant="lime">{cartCount}</Badge>
                </span>
              )}
            </Link>
          </div>
        </div>

        <div className="pb-2 md:hidden">
          <SearchBox locale={locale} placeholder={t('searchPlaceholderShort')} ariaLabel={t('searchAria')} />
        </div>
      </div>

      <nav aria-label="Primary" className="border-t border-[color:var(--slate-border)]">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <ul className="flex items-center gap-7 overflow-x-auto py-3 text-sm font-medium text-slate-70 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {navItems.map((item, i) => (
              <li key={item.key} className="whitespace-nowrap">
                <Link
                  href={item.href}
                  className={
                    i === 0
                      ? 'relative font-semibold text-green-dark after:absolute after:-bottom-3 after:start-0 after:h-0.5 after:w-full after:bg-lime'
                      : 'transition-colors hover:text-green-dark'
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
