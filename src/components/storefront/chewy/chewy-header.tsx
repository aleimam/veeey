'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { pick } from '@/lib/admin-i18n';
import { formatEGP } from '@/lib/format';
import { Icon } from '@/components/storefront/ui/icon';
import { Badge } from '@/components/storefront/ui/badge';
import { VeeeyLogo } from '@/components/storefront/veeey-logo';
import { LanguageSwitcher } from '@/components/storefront/language-switcher';

export type CartLine = { name: string; image: string; pricePiastres: number; qty: number };

type NavItem = { en: string; ar: string; href: string; mega?: 'goals' | 'supps'; lux?: boolean; hot?: boolean };

const NAV: NavItem[] = [
  { en: 'Shop by Goal', ar: 'تسوّق حسب الهدف', href: '/products', mega: 'goals' },
  { en: 'Supplements', ar: 'المكمّلات', href: '/products?kind=SUPPLEMENT', mega: 'supps' },
  { en: 'Devices', ar: 'الأجهزة', href: '/products?kind=DEVICE' },
  { en: 'Veeey Refill', ar: 'فيي ريفيل', href: '/refill' },
  { en: 'Veeey Select', ar: 'فيي سيلكت', href: '/select', lux: true },
  { en: "Today's Deals", ar: 'عروض اليوم', href: '/products?offers=1', hot: true },
  { en: 'Special Order', ar: 'طلب خاص', href: '/special-order' },
  { en: 'Learn', ar: 'تعلّم', href: '/learn' },
  { en: 'Blog', ar: 'المدوّنة', href: '/blog' },
];

const FREE_DELIVERY_PIASTRES = 150000; // EGP 1,500

export function ChewyHeader({
  locale,
  cartCount = 0,
  cartLines = [],
  subtotalPiastres = 0,
  isStaff = false,
}: {
  locale: string;
  cartCount?: number;
  cartLines?: CartLine[];
  subtotalPiastres?: number;
  isStaff?: boolean;
}) {
  const loc = useLocale();
  const t = pick(loc);
  const [mega, setMega] = useState<'goals' | 'supps' | null>(null);
  const [mobOpen, setMobOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50">
        <div className="bg-green-dark">
          <div className="mx-auto max-w-[1440px] px-3 py-2.5 sm:px-6 sm:py-3.5">
            <div className="flex items-center gap-2 sm:gap-5">
              {/* mobile menu */}
              <button onClick={() => setMobOpen(true)} className="text-white md:hidden" aria-label={t('Menu', 'القائمة')}>
                <Icon name="menu" size={26} color="#fff" />
              </button>

              <Link href="/" aria-label={t('Home', 'الرئيسية')} className="me-auto flex shrink-0 items-center md:me-0">
                <VeeeyLogo variant="light" size={36} priority />
              </Link>

              {/* desktop search */}
              <form action={`/${locale}/search`} className="hidden h-[46px] max-w-[560px] flex-1 items-center overflow-hidden rounded-full bg-white ps-4 md:flex">
                <input
                  name="q"
                  type="search"
                  placeholder={t('Search supplements, brands, goals…', 'ابحث عن مكمّلات أو علامات أو أهداف…')}
                  className="w-full border-none bg-transparent text-sm text-slate outline-none"
                  aria-label={t('Search', 'بحث')}
                />
                <button type="submit" aria-label={t('Search', 'بحث')} className="flex h-full items-center justify-center bg-lime px-4">
                  <Icon name="search" size={20} color="var(--green-dark)" />
                </button>
              </form>

              <div className="hidden md:block">
                <LanguageSwitcher className="flex items-center gap-2 text-sm text-white" />
              </div>

              {isStaff && (
                <Link href="/admin" className="hidden items-center gap-1.5 px-1.5 py-1.5 text-white md:inline-flex" aria-label={t('Admin', 'الإدارة')}>
                  <Icon name="shield-check" size={22} color="#fff" />
                </Link>
              )}

              <Link href="/account" className="flex items-center gap-1.5 px-1.5 py-1.5 text-white" aria-label={t('Account', 'الحساب')}>
                <Icon name="user" size={24} color="#fff" />
                <span className="hidden flex-col items-start leading-[1.15] lg:flex">
                  <span className="text-xs text-white/70">{t('Welcome', 'أهلاً')}</span>
                  <span className="text-[15px] font-bold">{t('Account', 'الحساب')}</span>
                </span>
              </Link>

              <button onClick={() => setCartOpen(true)} className="relative flex items-center gap-1.5 px-1.5 py-1.5 text-white" aria-label={t('Cart', 'السلة')}>
                <span className="relative">
                  <Icon name="shopping-cart" size={26} color="#fff" />
                  {cartCount > 0 && (
                    <span className="absolute -end-2.5 -top-2">
                      <Badge variant="lime">{cartCount}</Badge>
                    </span>
                  )}
                </span>
                <span className="hidden text-[15px] font-bold lg:inline">{t('Cart', 'السلة')}</span>
              </button>
            </div>

            {/* mobile search */}
            <form action={`/${locale}/search`} className="mt-2.5 flex h-11 items-center overflow-hidden rounded-full bg-white ps-4 md:hidden">
              <input
                name="q"
                type="search"
                placeholder={t('Search supplements, brands…', 'ابحث عن مكمّلات أو علامات…')}
                className="w-full border-none bg-transparent text-sm text-slate outline-none"
                aria-label={t('Search', 'بحث')}
              />
              <button type="submit" aria-label={t('Search', 'بحث')} className="flex h-full items-center justify-center bg-lime px-4">
                <Icon name="search" size={20} color="var(--green-dark)" />
              </button>
            </form>
          </div>

          {/* desktop nav row */}
          <div className="relative hidden border-t border-white/12 md:block">
            <div className="mx-auto flex h-[52px] max-w-[1440px] items-center gap-7 px-6">
              {NAV.map((n) => (
                <Link
                  key={n.en}
                  href={n.href}
                  onMouseEnter={() => setMega(n.mega ?? null)}
                  onClick={() => setMega(null)}
                  className={`inline-flex h-full items-center gap-1 border-b-[3px] text-[15px] font-bold ${
                    mega && mega === n.mega ? 'border-lime' : 'border-transparent'
                  } ${n.lux ? 'text-gold' : n.hot ? 'text-lime' : 'text-white/95'}`}
                >
                  {n.lux && <Icon name="crown" size={15} color="var(--gold)" />}
                  {t(n.en, n.ar)}
                  {n.mega && <Icon name="chevron-down" size={15} color="rgba(255,255,255,.7)" />}
                </Link>
              ))}
              <span className="ms-auto text-[15px] font-bold text-gold">{t('Free delivery over EGP 1,500', 'توصيل مجاني لأكثر من ١٥٠٠ ج.م')}</span>
            </div>
            {mega && <MegaMenu which={mega} t={t} onClose={() => setMega(null)} />}
          </div>
        </div>
      </header>

      {mobOpen && <MobileNav t={t} onClose={() => setMobOpen(false)} />}
      {cartOpen && (
        <CartDrawer
          t={t}
          lines={cartLines}
          subtotalPiastres={subtotalPiastres}
          count={cartCount}
          onClose={() => setCartOpen(false)}
        />
      )}
    </>
  );
}

type T = (en: string, ar: string) => string;

function MegaMenu({ which, t, onClose }: { which: 'goals' | 'supps'; t: T; onClose: () => void }) {
  const cols =
    which === 'goals'
      ? [
          { h: t('By goal', 'حسب الهدف'), items: ['Immunity', 'Energy', 'Sleep', 'Heart', 'Gut Health', 'Beauty', "Men's", 'Devices'] },
          { h: t('Popular', 'الأكثر رواجًا'), items: ['Best sellers', 'New arrivals', 'Expiry deals', 'Bundles & stacks'] },
          { h: t("Men's wellness", 'صحة الرجل'), items: ['Performance', 'Prostate', 'Testosterone', 'Energy'] },
        ]
      : [
          { h: t('By form', 'حسب الشكل'), items: ['Capsules & Tablets', 'Softgels & Oils', 'Powders & Greens', 'Liquids & Drops'] },
          { h: t('Top brands', 'أفضل العلامات'), items: ['Vital Nutrients', 'Sports Research', 'Terra Origin', 'Tru Niagen', 'Dr. Berg'] },
          { h: t('Health devices', 'الأجهزة الصحية'), items: ['Blood pressure', 'Glucose', 'Thermometers', 'Scales'] },
        ];
  return (
    <div onMouseLeave={onClose} className="absolute inset-x-0 top-full z-40 border-t border-[color:var(--green-dark-05)] bg-white shadow-[var(--shadow-lg)]">
      <div className="mx-auto grid max-w-[1440px] grid-cols-[repeat(3,1fr)_1.1fr] gap-8 px-6 pb-8 pt-7">
        {cols.map((c) => (
          <div key={c.h}>
            <div className="mb-3.5 text-xs font-bold uppercase tracking-[0.12em] text-green-mid">{c.h}</div>
            <div className="flex flex-col gap-2.5">
              {c.items.map((it) => (
                <Link key={it} href="/products" onClick={onClose} className="text-sm text-slate transition-colors hover:text-green-dark">
                  {it}
                </Link>
              ))}
            </div>
          </div>
        ))}
        <Link
          href="/refill"
          onClick={onClose}
          className="flex flex-col justify-between rounded-2xl p-[22px] text-white"
          style={{ background: 'linear-gradient(150deg,var(--green-dark),var(--green-emerald))' }}
        >
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-lime">{t('Veeey Refill', 'فيي ريفيل')}</div>
            <div className="mt-2 text-[22px] font-bold leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
              {t('Subscribe & save 15% on every delivery', 'اشترك ووفّر ١٥٪ على كل توصيلة')}
            </div>
          </div>
          <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-bold text-lime">
            {t('Set up a plan', 'ابدأ خطة')} <Icon name="arrow-right" size={15} color="var(--lime)" />
          </span>
        </Link>
      </div>
    </div>
  );
}

function MobileNav({ t, onClose }: { t: T; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60]">
      <div onClick={onClose} className="absolute inset-0" style={{ background: 'var(--scrim)' }} />
      <div className="absolute inset-y-0 start-0 w-[82%] max-w-[360px] overflow-y-auto bg-white p-5 shadow-[var(--shadow-lg)]">
        <div className="mb-4 flex items-center justify-between">
          <VeeeyLogo size={26} />
          <button onClick={onClose} aria-label={t('Close', 'إغلاق')}>
            <Icon name="x" size={24} color="var(--slate)" />
          </button>
        </div>
        <div className="flex flex-col">
          {NAV.map((n) => (
            <Link
              key={n.en}
              href={n.href}
              onClick={onClose}
              className="flex items-center justify-between border-b border-[color:var(--slate-border)] py-3.5 text-[16px] font-semibold text-slate"
            >
              {t(n.en, n.ar)}
              <Icon name="chevron-right" size={18} color="var(--slate-45)" />
            </Link>
          ))}
          <Link href="/account" onClick={onClose} className="flex items-center justify-between py-3.5 text-[16px] font-semibold text-slate">
            {t('My account', 'حسابي')}
            <Icon name="chevron-right" size={18} color="var(--slate-45)" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function CartDrawer({
  t,
  lines,
  subtotalPiastres,
  count,
  onClose,
}: {
  t: T;
  lines: CartLine[];
  subtotalPiastres: number;
  count: number;
  onClose: () => void;
}) {
  const pct = Math.min(100, Math.round((subtotalPiastres / FREE_DELIVERY_PIASTRES) * 100));
  const remaining = Math.max(0, FREE_DELIVERY_PIASTRES - subtotalPiastres);
  return (
    <div className="fixed inset-0 z-[70]">
      <div onClick={onClose} className="absolute inset-0" style={{ background: 'var(--scrim)' }} />
      <div className="absolute inset-y-0 end-0 flex w-[92%] max-w-[420px] flex-col bg-white shadow-[var(--shadow-lg)]">
        <div className="flex items-center justify-between border-b border-[color:var(--slate-border)] px-5 py-4">
          <div className="text-[22px] font-bold text-green-dark" style={{ fontFamily: 'var(--font-display)' }}>
            {t('Your Cart', 'سلتك')} ({count})
          </div>
          <button onClick={onClose} aria-label={t('Close', 'إغلاق')}>
            <Icon name="x" size={22} color="var(--slate)" />
          </button>
        </div>

        <div className="bg-green-wash px-5 py-3.5">
          {subtotalPiastres >= FREE_DELIVERY_PIASTRES ? (
            <div className="flex items-center gap-2 text-[13px] font-semibold text-green-dark">
              <Icon name="check-circle" size={16} color="var(--green-dark)" /> {t("You've unlocked free delivery!", 'حصلت على توصيل مجاني!')}
            </div>
          ) : (
            <div className="text-[13px] font-semibold text-green-dark">
              {t('{x} away from free delivery'.replace('{x}', formatEGP(remaining)), 'باقي {x} على التوصيل المجاني'.replace('{x}', formatEGP(remaining)))}
            </div>
          )}
          <div className="mt-2 h-[7px] overflow-hidden rounded-full bg-white">
            <div className="h-full bg-lime transition-[width]" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-2">
          {lines.length === 0 ? (
            <div className="py-12 text-center text-sm text-[color:var(--text-muted)]">{t('Your cart is empty.', 'سلتك فارغة.')}</div>
          ) : (
            lines.map((it, i) => (
              <div key={i} className="flex gap-3.5 border-b border-[color:var(--slate-border)] py-4">
                <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {it.image ? <img src={it.image} alt="" className="size-full object-contain p-1.5" /> : <Icon name="package" size={24} color="var(--slate-45)" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold leading-snug text-ink">{it.name}</div>
                  <div className="mt-1 text-sm font-bold text-green-dark">
                    {formatEGP(it.pricePiastres)} <span className="text-xs font-medium text-[color:var(--text-muted)]">× {it.qty}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-[color:var(--slate-border)] px-5 py-4 shadow-[0_-6px_20px_rgba(28,37,48,0.05)]">
          <div className="mb-3.5 flex items-center justify-between">
            <span className="text-[15px] text-slate">{t('Subtotal', 'الإجمالي الفرعي')}</span>
            <span className="text-[22px] font-bold text-green-dark">{formatEGP(subtotalPiastres)}</span>
          </div>
          <Link href="/cart" onClick={onClose} className="v-btn v-btn--secondary v-btn--block mb-2">
            {t('View cart', 'عرض السلة')}
          </Link>
          <Link href="/checkout" onClick={onClose} className="v-btn v-btn--primary v-btn--block">
            {t('Checkout', 'إتمام الشراء')}
          </Link>
        </div>
      </div>
    </div>
  );
}
