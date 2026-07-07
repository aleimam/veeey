import { setRequestLocale } from 'next-intl/server';
import { requirePermission } from '@/lib/auth-guards';
import { getNavConfig } from '@/lib/nav-service';
import { pick } from '@/lib/admin-i18n';
import { NavEditor } from '@/components/admin/nav-editor';

export const dynamic = 'force-dynamic';

export default async function AdminNavigationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requirePermission('settings.manage');
  const tb = pick(locale);
  const nav = await getNavConfig();

  return (
    <div className="p-4 sm:p-6">
      <header className="mb-5">
        <h1 className="font-heading text-xl font-semibold text-foreground">{tb('Navigation', 'شريط التنقّل')}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {tb(
            'Edit the main menu bar and its dropdowns — labels, links, icons, colors, font and order.',
            'حرّر شريط القائمة الرئيسي وقوائمه المنسدلة — التسميات والروابط والأيقونات والألوان والخط والترتيب.',
          )}
        </p>
      </header>
      <NavEditor initial={nav} locale={locale} />
    </div>
  );
}
