import { cookies } from 'next/headers';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth-guards';
import { canAccessAdmin } from '@/lib/rbac';
import type { PermissionKey } from '@/lib/permissions';
import { pick } from '@/lib/admin-i18n';
import { AdminShell, type NavSection } from '@/components/admin/admin-shell';

// Admin is always dynamic (reads the session + theme cookies).
export const dynamic = 'force-dynamic';

type NavItem = { href: string; key: string; permission?: PermissionKey };
type RawSection = { title: [string, string]; items: NavItem[] };

// Grouped sidebar (FR-ADMIN). Section titles are bilingual [en, ar]; item labels
// come from the admin.nav message keys; icon = the item key (mapped in AdminShell).
// Empty sections (all items gated out by RBAC) are hidden.
const NAV_SECTIONS: RawSection[] = [
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
    { href: '/admin/go-live', key: 'goLive', permission: 'catalog.write' },
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
    { href: '/admin/landing', key: 'landing', permission: 'content.manage' },
    { href: '/admin/page-sections', key: 'pageSections', permission: 'content.manage' },
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
    { href: '/admin/payments', key: 'payments', permission: 'settings.manage' },
    { href: '/admin/order-statuses', key: 'orderStatuses', permission: 'settings.manage' },
    { href: '/admin/providers', key: 'providers', permission: 'settings.manage' },
    { href: '/admin/appearance', key: 'appearance', permission: 'settings.manage' },
    { href: '/admin/login-providers', key: 'loginProviders', permission: 'settings.manage' },
  ] },
  { title: ['Egypt Vitamins', 'إيجيبت فيتامينز'], items: [
    { href: '/admin/woocommerce', key: 'wooConnection', permission: 'settings.manage' },
    { href: '/admin/woocommerce/products', key: 'wooProducts', permission: 'settings.manage' },
    { href: '/admin/woocommerce/customers', key: 'wooCustomers', permission: 'settings.manage' },
    { href: '/admin/woocommerce/orders', key: 'wooOrders', permission: 'settings.manage' },
    { href: '/admin/woocommerce/import', key: 'wooImport', permission: 'settings.manage' },
    { href: '/admin/woocommerce/sync', key: 'wooSync', permission: 'settings.manage' },
    { href: '/admin/woocommerce/cleanup', key: 'wooCleanup', permission: 'settings.manage' },
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
  if (!user) return null;
  if (!canAccessAdmin(user.permissions)) redirect({ href: '/', locale });

  const t = await getTranslations('admin');
  const tb = pick(locale);
  const cookieStore = await cookies();
  const dark = cookieStore.get('admin-theme')?.value === 'dark';
  const collapsed = cookieStore.get('admin-sidebar')?.value === 'collapsed';

  const sections: NavSection[] = NAV_SECTIONS.map((s) => ({
    title: tb(s.title[0], s.title[1]),
    items: s.items
      .filter((item) => !item.permission || user.permissions.includes(item.permission))
      .map((item) => ({ href: item.href, label: t(`nav.${item.key}`), icon: item.key })),
  })).filter((s) => s.items.length > 0);

  return (
    <AdminShell
      locale={locale}
      sections={sections}
      user={{ email: user.email ?? '—', role: user.roleKey ?? t('shell.noRole'), initial: (user.email ?? '?').slice(0, 1).toUpperCase() }}
      dark={dark}
      collapsed={collapsed}
    >
      {children}
    </AdminShell>
  );
}
