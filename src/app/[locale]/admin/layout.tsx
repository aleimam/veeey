import { setRequestLocale } from 'next-intl/server';
import { redirect, Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth-guards';
import { canAccessAdmin } from '@/lib/rbac';
import type { PermissionKey } from '@/lib/permissions';
import { signOutAction } from '@/server/auth-actions';

// Admin is always dynamic (reads the session).
export const dynamic = 'force-dynamic';

const NAV: { href: string; label: string; permission?: PermissionKey }[] = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/analytics', label: 'Analytics', permission: 'finance.read' },
  { href: '/admin/orders', label: 'Orders', permission: 'orders.read' },
  { href: '/admin/returns', label: 'Returns', permission: 'returns.manage' },
  { href: '/admin/products', label: 'Products', permission: 'catalog.read' },
  { href: '/admin/inventory', label: 'Inventory', permission: 'inventory.manage' },
  { href: '/admin/stocktake', label: 'Stocktake', permission: 'stocktake.manage' },
  { href: '/admin/gifts', label: 'Gifts', permission: 'orders.write' },
  { href: '/admin/brands', label: 'Brands', permission: 'catalog.write' },
  { href: '/admin/categories', label: 'Categories', permission: 'catalog.write' },
  { href: '/admin/tags', label: 'Tags', permission: 'catalog.write' },
  { href: '/admin/attributes', label: 'Attributes', permission: 'catalog.write' },
  { href: '/admin/customers', label: 'Customers', permission: 'customers.read' },
  { href: '/admin/coupons', label: 'Coupons', permission: 'coupons.manage' },
  { href: '/admin/collections', label: 'Collections', permission: 'content.manage' },
  { href: '/admin/content/pages', label: 'CMS Pages', permission: 'content.manage' },
  { href: '/admin/content/blog', label: 'Blog', permission: 'content.manage' },
  { href: '/admin/reviews', label: 'Reviews', permission: 'reviews.moderate' },
  { href: '/admin/quizzes', label: 'Quizzes', permission: 'content.manage' },
  { href: '/admin/notifications', label: 'Notifications', permission: 'content.manage' },
  { href: '/admin/integration', label: 'Integration', permission: 'settings.manage' },
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

  const nav = NAV.filter((item) => !item.permission || user.permissions.includes(item.permission));

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-60 shrink-0 border-e border-border bg-surface p-4 sm:block">
        <div className="mb-6 font-heading text-lg font-semibold text-primary">
          Veeey Admin
        </div>
        <nav className="flex flex-col gap-1">
          {nav.map((item, i) => (
            <Link
              key={`${item.label}-${i}`}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-secondary-foreground hover:bg-card"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-6 py-3">
          <span className="text-sm text-muted-foreground">
            {user.email} · {user.roleKey ?? 'no role'}
          </span>
          <form action={signOutAction}>
            <button className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface">
              Sign out
            </button>
          </form>
        </header>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
