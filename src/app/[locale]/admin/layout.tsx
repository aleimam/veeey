import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect, Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth-guards';
import { canAccessAdmin } from '@/lib/rbac';
import type { PermissionKey } from '@/lib/permissions';
import { signOutAction } from '@/server/auth-actions';
import { LanguageSwitcher } from '@/components/storefront/language-switcher';
import { pick } from '@/lib/admin-i18n';

// Admin is always dynamic (reads the session).
export const dynamic = 'force-dynamic';

type NavItem = { href: string; key: string; permission?: PermissionKey };
type NavSection = { title: [string, string]; items: NavItem[] };

// Grouped sidebar (FR-ADMIN). Section titles are bilingual [en, ar]; item labels
// come from the admin.nav message keys. Empty sections (all items gated out by
// RBAC) are hidden.
const NAV_SECTIONS: NavSection[] = [
  { title: ['Dashboard', 'الرئيسية'], items: [
    { href: '/admin', key: 'dashboard' },
    { href: '/admin/analytics', key: 'analytics', permission: 'finance.read' },
  ] },
  { title: ['Orders', 'الطلبات'], items: [
    { href: '/admin/orders', key: 'orders', permission: 'orders.read' },
    { href: '/admin/returns', key: 'returns', permission: 'returns.manage' },
    { href: '/admin/special-orders', key: 'specialOrders', permission: 'orders.read' },
    { href: '/admin/gifts', key: 'gifts', permission: 'orders.write' },
  ] },
  { title: ['Catalog', 'الكتالوج'], items: [
    { href: '/admin/products', key: 'products', permission: 'catalog.read' },
    { href: '/admin/brands', key: 'brands', permission: 'catalog.write' },
    { href: '/admin/categories', key: 'categories', permission: 'catalog.write' },
    { href: '/admin/tags', key: 'tags', permission: 'catalog.write' },
    { href: '/admin/attributes', key: 'attributes', permission: 'catalog.write' },
    { href: '/admin/collections', key: 'collections', permission: 'content.manage' },
  ] },
  { title: ['Inventory', 'المخزون'], items: [
    { href: '/admin/inventory', key: 'inventory', permission: 'inventory.manage' },
    { href: '/admin/stocktake', key: 'stocktake', permission: 'stocktake.manage' },
  ] },
  { title: ['Shipping', 'الشحن'], items: [
    { href: '/admin/shipping', key: 'shipping', permission: 'settings.manage' },
  ] },
  { title: ['Customers', 'العملاء'], items: [
    { href: '/admin/customers', key: 'customers', permission: 'customers.read' },
    { href: '/admin/tiers', key: 'tiers', permission: 'pricing.manage' },
    { href: '/admin/coupons', key: 'coupons', permission: 'coupons.manage' },
    { href: '/admin/reviews', key: 'reviews', permission: 'reviews.moderate' },
  ] },
  { title: ['Website', 'الموقع'], items: [
    { href: '/admin/homepage', key: 'homepage', permission: 'content.manage' },
    { href: '/admin/content/pages', key: 'cmsPages', permission: 'content.manage' },
    { href: '/admin/content/blog', key: 'blog', permission: 'content.manage' },
    { href: '/admin/social', key: 'social', permission: 'content.manage' },
  ] },
  { title: ['Tools', 'الأدوات'], items: [
    { href: '/admin/quizzes', key: 'quizzes', permission: 'content.manage' },
    { href: '/admin/notifications', key: 'notifications', permission: 'content.manage' },
  ] },
  { title: ['Users & roles', 'المستخدمون والأدوار'], items: [
    { href: '/admin/users', key: 'users', permission: 'rbac.manage' },
    { href: '/admin/roles', key: 'roles', permission: 'rbac.manage' },
  ] },
  { title: ['Administration', 'الإدارة'], items: [
    { href: '/admin/settings', key: 'settings', permission: 'settings.manage' },
    { href: '/admin/providers', key: 'providers', permission: 'settings.manage' },
  ] },
  { title: ['API', 'الواجهة البرمجية'], items: [
    { href: '/admin/integration', key: 'integration', permission: 'settings.manage' },
  ] },
];

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });
  // `redirect` returns never, but narrow for the type-checker.
  if (!user) return null;
  if (!canAccessAdmin(user.permissions)) redirect({ href: '/', locale });

  const t = await getTranslations('admin');
  const tb = pick(locale);
  const sections = NAV_SECTIONS
    .map((s) => ({ ...s, items: s.items.filter((item) => !item.permission || user.permissions.includes(item.permission)) }))
    .filter((s) => s.items.length > 0);

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-60 shrink-0 border-e border-border bg-surface p-4 sm:block">
        <div className="mb-6 font-heading text-lg font-semibold text-primary">
          {t('shell.title')}
        </div>
        <nav className="flex flex-col gap-4">
          {sections.map((section) => (
            <div key={section.title[0]}>
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {tb(section.title[0], section.title[1])}
              </div>
              <div className="flex flex-col gap-0.5">
                {section.items.map((item, i) => (
                  <Link
                    key={`${item.key}-${i}`}
                    href={item.href}
                    className="rounded-md px-3 py-2 text-sm text-secondary-foreground hover:bg-card"
                  >
                    {t(`nav.${item.key}`)}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-6 py-3">
          <span className="text-sm text-muted-foreground">
            {user.email} · {user.roleKey ?? t('shell.noRole')}
          </span>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <form action={signOutAction}>
              <button className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface">
                {t('shell.signOut')}
              </button>
            </form>
          </div>
        </header>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
