import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth-guards';
import { hasPermission } from '@/lib/rbac';
import { pick } from '@/lib/admin-i18n';
import { prisma } from '@/lib/prisma';
import { listThemes } from '@/lib/theme-service';
import { AppearanceManager } from '@/components/admin/appearance-manager';

export const dynamic = 'force-dynamic';

export default async function AppearancePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });
  if (!user) return null;
  if (!hasPermission(user.permissions, 'settings.manage')) redirect({ href: '/admin', locale });

  const [themes, tiersRaw] = await Promise.all([
    listThemes(),
    prisma.tier.findMany({ orderBy: { rank: 'asc' } }),
  ]);
  const tiers = tiersRaw.map((tier) => ({
    id: tier.id,
    key: tier.key,
    name: (locale === 'ar' ? tier.nameAr : tier.nameEn) ?? tier.nameEn,
    themeId: tier.themeId,
  }));

  return (
    <div className="p-6">
      <h1 className="mb-2 font-heading text-xl font-semibold">{tb('Appearance', 'المظهر')}</h1>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        {tb(
          'Create multiple storefront themes — colours, typography, spacing, radii, shadows and motion — switch the active theme, and assign a theme per customer tier. The admin panel is never themed. Leave a field blank to keep the design-system default.',
          'أنشئ ثيمات متعددة للمتجر — الألوان والخطوط والمسافات والزوايا والظلال والحركة — وبدّل الثيم النشط، وعيّن ثيمًا لكل فئة عملاء. لا تتأثر لوحة الإدارة أبدًا. اترك الحقل فارغًا للإبقاء على القيمة الافتراضية.',
        )}
      </p>
      <AppearanceManager themes={themes} tiers={tiers} locale={locale} />
    </div>
  );
}
