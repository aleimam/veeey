'use client';

import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { pick } from '@/lib/admin-i18n';
import { LanguageSwitcher } from '@/components/storefront/language-switcher';
import { signOutAction } from '@/server/auth-actions';
import { CommandPalette } from '@/components/admin/command-palette';
import {
  LayoutDashboard, BarChart3, ShoppingCart, RotateCcw, Globe, Gift, Package, Award,
  FolderTree, Tags, SlidersHorizontal, LayoutGrid, Boxes, ClipboardCheck, Truck, Users,
  Crown, Ticket, Star, Home, FileText, Newspaper, Share2, HelpCircle, Bell, UserCog,
  ShieldCheck, Settings, Plug, Palette, Webhook, Menu, X, Search, PanelLeftClose,
  PanelLeftOpen, Sun, Moon, LogOut, ExternalLink, ChevronRight, KeyRound, Cable, DatabaseZap, RefreshCw,
} from 'lucide-react';

export type NavItem = { href: string; label: string; icon: string };
export type NavSection = { title: string; items: NavItem[] };

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard, analytics: BarChart3, orders: ShoppingCart, returns: RotateCcw,
  specialOrders: Globe, gifts: Gift, products: Package, brands: Award, categories: FolderTree,
  tags: Tags, attributes: SlidersHorizontal, collections: LayoutGrid, inventory: Boxes,
  stocktake: ClipboardCheck, shipping: Truck, customers: Users, tiers: Crown, coupons: Ticket,
  reviews: Star, homepage: Home, cmsPages: FileText, blog: Newspaper, social: Share2,
  quizzes: HelpCircle, notifications: Bell, users: UserCog, roles: ShieldCheck, settings: Settings,
  providers: Plug, appearance: Palette, loginProviders: KeyRound, integration: Webhook,
  wooConnection: Cable, wooProducts: Package, wooCustomers: Users, wooOrders: ShoppingCart, wooImport: DatabaseZap, wooSync: RefreshCw,
};

function setCookie(k: string, v: string) {
  document.cookie = `${k}=${v}; path=/; max-age=31536000; samesite=lax`;
}

const isActivePath = (pathname: string, href: string) =>
  href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`);

function SidebarNav({
  sections,
  collapsedView,
  pathname,
  onNavigate,
}: {
  sections: NavSection[];
  collapsedView: boolean;
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <nav className="flex flex-col gap-4">
      {sections.map((section) => (
        <div key={section.title}>
          {!collapsedView && <div className="px-3 pb-1 text-[11px] text-white/45">{section.title}</div>}
          <div className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const Ic = ICONS[item.icon] ?? Package;
              const on = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  title={collapsedView ? item.label : undefined}
                  className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] transition-colors ${collapsedView ? 'justify-center' : ''} ${
                    on ? 'bg-white/12 font-medium text-white' : 'text-white/80 hover:bg-white/8 hover:text-white'
                  }`}
                  style={on ? { boxShadow: 'inset 2px 0 0 #d1d725' } : undefined}
                >
                  <Ic size={18} className={on ? 'text-lime' : 'text-white/70'} />
                  {!collapsedView && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function AdminShell({
  locale,
  sections,
  user,
  dark: initialDark,
  collapsed: initialCollapsed,
  children,
}: {
  locale: string;
  sections: NavSection[];
  user: { email: string; role: string; initial: string };
  dark: boolean;
  collapsed: boolean;
  children: React.ReactNode;
}) {
  const t = pick(locale);
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(initialDark);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobOpen, setMobOpen] = useState(false);

  const flat = sections.flatMap((s) => s.items.map((i) => ({ href: i.href, label: i.label, section: s.title })));
  const current = [...flat].sort((a, b) => b.href.length - a.href.length).find((i) => isActivePath(pathname, i.href));

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    setCookie('admin-theme', next ? 'dark' : 'light');
  };
  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    setCookie('admin-sidebar', next ? 'collapsed' : 'expanded');
  };

  const railBg = isDark ? '#12211a' : '#235c3c';

  return (
    <div data-admin-root className={`${isDark ? 'dark' : ''} flex min-h-dvh bg-background text-foreground`}>
      {/* desktop sidebar */}
      <aside
        className={`sticky top-0 hidden h-dvh shrink-0 flex-col overflow-y-auto p-3 text-white md:flex ${collapsed ? 'w-[68px]' : 'w-60'}`}
        style={{ background: railBg }}
      >
        <Link href="/admin" className={`mb-4 flex items-center gap-2 px-1.5 py-1 ${collapsed ? 'justify-center' : ''}`}>
          <span className="flex size-7 items-center justify-center rounded-md bg-lime text-[15px] font-semibold text-[#235c3c]">V</span>
          {!collapsed && (
            <span className="flex items-baseline gap-1.5">
              <span className="text-[15px] font-semibold">Veeey</span>
              <span className="text-[11px] text-white/55">{t('admin', 'الإدارة')}</span>
            </span>
          )}
        </Link>
        <SidebarNav sections={sections} collapsedView={collapsed} pathname={pathname} onNavigate={() => setMobOpen(false)} />
      </aside>

      {/* mobile drawer */}
      {mobOpen && (
        <div className="fixed inset-0 z-[80] md:hidden">
          <div className="absolute inset-0 bg-foreground/50" onClick={() => setMobOpen(false)} />
          <div className="absolute inset-y-0 start-0 w-[78%] max-w-[280px] overflow-y-auto p-3 text-white" style={{ background: railBg }}>
            <div className="mb-4 flex items-center justify-between px-1.5">
              <span className="text-[15px] font-semibold">Veeey {t('admin', 'الإدارة')}</span>
              <button onClick={() => setMobOpen(false)} aria-label={t('Close', 'إغلاق')}><X size={20} /></button>
            </div>
            <SidebarNav sections={sections} collapsedView={false} pathname={pathname} onNavigate={() => setMobOpen(false)} />
          </div>
        </div>
      )}

      {/* main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-card px-3 py-2.5 sm:px-4">
          <button onClick={() => setMobOpen(true)} className="text-muted-foreground hover:text-foreground md:hidden" aria-label={t('Open menu', 'فتح القائمة')}><Menu size={20} /></button>
          <button onClick={toggleCollapsed} className="hidden text-muted-foreground hover:text-foreground md:inline-flex" aria-label={t('Toggle sidebar', 'طي الشريط الجانبي')}>
            {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
          </button>

          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">{t('Admin', 'الإدارة')}</span>
            {current && <><ChevronRight size={14} className="text-muted-foreground" /><span className="font-medium text-foreground">{current.label}</span></>}
          </div>

          <button
            onClick={() => window.dispatchEvent(new Event('veeey:cmdk'))}
            className="mx-2 hidden h-9 max-w-[260px] flex-1 items-center gap-2 rounded-md border border-border px-3 text-sm text-muted-foreground transition-colors hover:border-ring sm:flex"
          >
            <Search size={16} /> {t('Search…', 'بحث…')}
            <kbd className="ms-auto rounded border border-border px-1.5 text-[11px]">⌘K</kbd>
          </button>

          <div className="ms-auto flex items-center gap-1.5">
            <button onClick={() => window.dispatchEvent(new Event('veeey:cmdk'))} className="text-muted-foreground hover:text-foreground sm:hidden" aria-label={t('Search', 'بحث')}><Search size={19} /></button>
            <Link href="/" className="hidden items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground lg:inline-flex">
              <ExternalLink size={15} /> {t('View store', 'عرض المتجر')}
            </Link>
            <LanguageSwitcher className="text-sm text-muted-foreground" />
            <button onClick={toggleDark} className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={t('Toggle dark mode', 'تبديل الوضع الداكن')}>
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Link href="/admin/profile" className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent" title={`${user.email} · ${user.role}`}>
              <span className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-xs font-medium text-primary">{user.initial}</span>
              <span className="hidden flex-col items-start leading-tight lg:flex">
                <span className="max-w-[160px] truncate text-[13px] font-medium text-foreground">{user.email}</span>
                <span className="text-[11px] text-muted-foreground">{user.role}</span>
              </span>
            </Link>
            <form action={signOutAction}>
              <button className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={t('Sign out', 'تسجيل الخروج')}><LogOut size={17} /></button>
            </form>
          </div>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <CommandPalette items={flat} locale={locale} />
    </div>
  );
}
