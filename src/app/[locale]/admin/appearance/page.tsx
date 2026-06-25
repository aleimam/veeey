import { setRequestLocale } from 'next-intl/server';
import { getThemeOverrides } from '@/lib/theme-service';
import { pick } from '@/lib/admin-i18n';
import { AppearanceEditor } from '@/components/admin/appearance-editor';

export const dynamic = 'force-dynamic';

export default async function AppearancePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const overrides = await getThemeOverrides();

  return (
    <div className="p-6">
      <h1 className="mb-2 font-heading text-xl font-semibold">{tb('Appearance', 'المظهر')}</h1>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        {tb(
          'Edit the storefront theme — colours, typography, spacing, radii, shadows and motion. Changes apply across the storefront on Save; the admin panel is unaffected. Leave a field blank to keep the design-system default.',
          'حرّر ثيم المتجر — الألوان والخطوط والمسافات والزوايا والظلال والحركة. تُطبَّق التغييرات على المتجر عند الحفظ؛ ولا تتأثر لوحة الإدارة. اترك الحقل فارغًا للإبقاء على القيمة الافتراضية.',
        )}
      </p>
      <AppearanceEditor initial={overrides} />
    </div>
  );
}
