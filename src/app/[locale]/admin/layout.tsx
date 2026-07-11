import { cookies } from 'next/headers';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth-guards';
import { canAccessAdmin } from '@/lib/rbac';
import { pick } from '@/lib/admin-i18n';
import { NAV_SECTIONS } from '@/lib/admin-nav';
import { AdminShell, type NavSection } from '@/components/admin/admin-shell';

// Admin is always dynamic (reads the session + theme cookies).
export const dynamic = 'force-dynamic';


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
