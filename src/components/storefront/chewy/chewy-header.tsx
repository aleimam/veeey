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
import { SearchAutocomplete } from '@/components/storefront/chewy/search-autocomplete';
import { navFontResolve, type NavConfig, type NavItem } from '@/lib/nav-config';

export type CartLine = { name: string; image: string; pricePiastres: number; qty: number };

const FREE_DELIVERY_PIASTRES = 150000; // EGP 1,500

export function ChewyHeader({
  locale,
  nav,
  cartCount = 0,
  cartLines = [],
  subtotalPiastres = 0,
  isStaff = false,
  help,
}: {
  locale: string;
  nav: NavConfig;
  cartCount?: number;
  cartLines?: CartLine[];
  subtotalPiastres?: number;
  isStaff?: boolean;
  help?: { whatsapp?: string; phone?: string };
}) {
  const loc = useLocale();
  const t = pick(loc);
  const [mega, setMega] = useState<string | null>(null);
  const [mobOpen, setMobOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const navFontCss = navFontResolve(nav.fontFamily).css;
  const navItems = nav.items.filter((i) => i.visible);
  const activeItem = navItems.find((i) => i.id === mega) ?? null;

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
              <SearchAutocomplete
                locale={locale}
                placeholder={t('Search supplements, brands, goals…', 'ابحث عن مكمّلات أو علامات أو أهداف…')}
                className="hidden h-[46px] max-w-[560px] flex-1 md:block"
              />

              {/* 24/7 help dropdown (audit P2 6.1) — pharmacist line, WhatsApp, call */}
              <div className="relative hidden md:block" onMouseEnter={() => setHelpOpen(true)} onMouseLeave={() => setHelpOpen(false)}>
                <button
                  type="button"
                  aria-expanded={helpOpen}
                  onClick={() => setHelpOpen((v) => !v)}
                  className="flex items-center gap-1.5 px-1.5 py-1.5 text-white"
                >
                  <Icon name="messages-square" size={22} color="#fff" />
                  <span className="hidden flex-col items-start leading-[1.15] lg:flex">
                    <span className="text-xs text-white/70">{t('24/7', '٢٤/٧')}</span>
                    <span className="text-[15px] font-bold">{t('Help', 'مساعدة')}</span>
                  </span>
                  <Icon name="chevron-down" size={14} color="#fff" />
                </button>
                {helpOpen && (
                  <div className="absolute end-0 top-full z-50 w-72 rounded-[14px] border border-[color:var(--slate-border)] bg-white p-4 text-ink shadow-[var(--shadow-lg)]">
                    <p className="mb-3 text-sm font-bold text-green-dark">
                      {t('Get 24/7 help from our expert pharmacist', 'احصل على مساعدة على مدار الساعة من صيدلينا الخبير')}
                    </p>
                    <div className="flex flex-col gap-2">
                      {help?.whatsapp && (
                        <a
                          href={`https://wa.me/${help.whatsapp}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2.5 rounded-[10px] bg-green-wash px-3 py-2.5 text-sm font-semibold text-green-dark hover:bg-lime-wash"
                        >
                          <Icon name="message-circle" size={18} color="var(--green-dark)" /> {t('Chat on WhatsApp', 'دردش على واتساب')}
                        </a>
                      )}
                      {help?.phone && (
                        <a
                          href={`tel:${help.phone}`}
                          className="flex items-center gap-2.5 rounded-[10px] bg-surface px-3 py-2.5 text-sm font-semibold text-ink hover:bg-green-wash"
                        >
                          <Icon name="stethoscope" size={18} color="var(--green-dark)" /> {t(`Call us: ${help.phone}`, `اتصل بنا: ${help.phone}`)}
                        </a>
                      )}
                      <Link
                        href="/p/faq"
                        onClick={() => setHelpOpen(false)}
                        className="flex items-center gap-2.5 rounded-[10px] bg-surface px-3 py-2.5 text-sm font-semibold text-ink hover:bg-green-wash"
                      >
                        <Icon name="book-open" size={18} color="var(--green-dark)" /> {t('Help & FAQ', 'المساعدة والأسئلة الشائعة')}
                      </Link>
                    </div>
                  </div>
                )}
              </div>

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
            <SearchAutocomplete
              locale={locale}
              placeholder={t('Search supplements, brands…', 'ابحث عن مكمّلات أو علامات…')}
              className="mt-2.5 h-11 md:hidden"
            />
          </div>

          {/* desktop nav row (rendered from the editable nav config) */}
          <div className="relative hidden border-t border-white/12 md:block" style={navFontCss ? { fontFamily: navFontCss } : undefined}>
            <div className="mx-auto flex h-[52px] max-w-[1440px] items-center gap-7 px-6">
              {navItems.map((n) => {
                const color = n.color || nav.baseColor;
                return (
                  <Link
                    key={n.id}
                    href={n.href}
                    onMouseEnter={() => setMega(n.mega ? n.id : null)}
                    onClick={() => setMega(null)}
                    className={`inline-flex h-full items-center gap-1 border-b-[3px] ${mega === n.id ? 'border-lime' : 'border-transparent'}`}
                    style={{ color, fontSize: `${n.sizePx ?? nav.baseSizePx}px`, fontWeight: n.bold ? 700 : 500 }}
                  >
                    {n.icon && <Icon name={n.icon} size={15} color={color} />}
                    {t(n.labelEn, n.labelAr)}
                    {n.mega && <Icon name="chevron-down" size={15} color="rgba(255,255,255,.7)" />}
                  </Link>
                );
              })}
              {nav.promo.enabled &&
                (nav.promo.href ? (
                  <Link href={nav.promo.href} className="ms-auto font-bold" style={{ color: nav.promo.color, fontSize: `${nav.baseSizePx}px` }}>
                    {t(nav.promo.textEn, nav.promo.textAr)}
                  </Link>
                ) : (
                  <span className="ms-auto font-bold" style={{ color: nav.promo.color, fontSize: `${nav.baseSizePx}px` }}>
                    {t(nav.promo.textEn, nav.promo.textAr)}
                  </span>
                ))}
            </div>
            {activeItem?.mega && <MegaMenu item={activeItem} t={t} onClose={() => setMega(null)} />}
          </div>
        </div>
      </header>

      {mobOpen && <MobileNav nav={nav} t={t} onClose={() => setMobOpen(false)} />}
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

function MegaMenu({ item, t, onClose }: { item: NavItem; t: T; onClose: () => void }) {
  const mega = item.mega;
  if (!mega) return null;
  const hasPromo = !!mega.promo?.enabled;
  const gridCols = `repeat(${Math.max(1, mega.columns.length)},1fr)${hasPromo ? ' 1.1fr' : ''}`;
  return (
    <div onMouseLeave={onClose} className="absolute inset-x-0 top-full z-40 border-t border-[color:var(--green-dark-05)] bg-white shadow-[var(--shadow-lg)]">
      <div className="mx-auto grid max-w-[1440px] gap-8 px-6 pb-8 pt-7" style={{ gridTemplateColumns: gridCols }}>
        {mega.columns.map((c) => (
          <div key={c.id}>
            <div className="mb-3.5 text-xs font-bold uppercase tracking-[0.12em] text-green-mid">{t(c.headingEn, c.headingAr)}</div>
            <div className="flex flex-col gap-2.5">
              {c.links.map((l) => (
                <Link key={l.id} href={l.href} onClick={onClose} className="text-sm text-slate transition-colors hover:text-green-dark">
                  {t(l.labelEn, l.labelAr)}
                </Link>
              ))}
            </div>
          </div>
        ))}
        {hasPromo && mega.promo && (
          <Link
            href={mega.promo.href}
            onClick={onClose}
            className="flex flex-col justify-between rounded-2xl p-[22px] text-white"
            style={{ background: 'linear-gradient(150deg,var(--green-dark),var(--green-emerald))' }}
          >
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-lime">{t(mega.promo.eyebrowEn, mega.promo.eyebrowAr)}</div>
              <div className="mt-2 text-[22px] font-bold leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                {t(mega.promo.titleEn, mega.promo.titleAr)}
              </div>
            </div>
            <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-bold text-lime">
              {t(mega.promo.ctaEn, mega.promo.ctaAr)} <Icon name="arrow-right" size={15} color="var(--lime)" />
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}

function MobileNav({ nav, t, onClose }: { nav: NavConfig; t: T; onClose: () => void }) {
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
          {nav.items.filter((i) => i.visible).map((n) => (
            <Link
              key={n.id}
              href={n.href}
              onClick={onClose}
              className="flex items-center justify-between border-b border-[color:var(--slate-border)] py-3.5 text-[16px] font-semibold text-slate"
            >
              <span className="inline-flex items-center gap-2">
                {n.icon && <Icon name={n.icon} size={17} color="var(--green-dark)" />}
                {t(n.labelEn, n.labelAr)}
              </span>
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
