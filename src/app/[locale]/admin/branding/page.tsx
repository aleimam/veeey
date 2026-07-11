import Image from 'next/image';
import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth-guards';
import { hasPermission } from '@/lib/rbac';
import { pick } from '@/lib/admin-i18n';
import { getBranding } from '@/lib/branding-service';
import { DEFAULT_BRANDING } from '@/lib/branding';
import { saveBrandingAction } from '@/server/branding-actions';
import { SingleImageUploader } from '@/components/admin/image-uploader';
import { inputCls } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';
type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function BrandingPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });
  if (!user) return null;
  if (!hasPermission(user.permissions, 'settings.manage')) redirect({ href: '/admin', locale });

  const b = await getBranding();
  const saved = one(sp.saved);

  return (
    <div className="max-w-3xl p-6">
      <h1 className="mb-1 font-heading text-xl font-semibold">{tb('Branding', 'الهوية والعلامة')}</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {tb(
          'Site name, browser-tab titles, logos and favicon. Leave a field blank to use the built-in Veeey default. Changes apply to the storefront immediately.',
          'اسم الموقع وعناوين المتصفح والشعارات وأيقونة الموقع. اترك أي حقل فارغًا لاستخدام قيمة Veeey الافتراضية. تُطبَّق التغييرات على المتجر فورًا.',
        )}
      </p>

      {saved != null && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Branding saved ✓', 'تم حفظ الهوية ✓')}</p>}

      <form action={saveBrandingAction} className="space-y-8">
        <input type="hidden" name="locale" value={locale} />

        <section className="rounded-lg border border-border p-4">
          <h2 className="mb-3 font-heading text-base font-semibold">{tb('Site name', 'اسم الموقع')}</h2>
          <p className="mb-3 text-xs text-muted-foreground">{tb('Used in the header/footer logo alt text, Google structured data and the installable app name.', 'يُستخدم في النص البديل للشعار وبيانات جوجل المنظمة واسم التطبيق القابل للتثبيت.')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">{tb('Name (EN)', 'الاسم (EN)')}
              <input name="siteNameEn" defaultValue={b.siteNameEn} placeholder={DEFAULT_BRANDING.siteNameEn} className={inputCls} />
            </label>
            <label className="text-sm font-medium">{tb('Name (AR)', 'الاسم (AR)')}
              <input name="siteNameAr" defaultValue={b.siteNameAr} dir="rtl" placeholder={DEFAULT_BRANDING.siteNameAr} className={inputCls} />
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-border p-4">
          <h2 className="mb-3 font-heading text-base font-semibold">{tb('Browser-tab title', 'عنوان تبويب المتصفح')}</h2>
          <p className="mb-3 text-xs text-muted-foreground">{tb('The default title shown in the browser tab and search results. Pages with their own SEO title (products, categories, homepage) override it.', 'العنوان الافتراضي الظاهر في تبويب المتصفح ونتائج البحث. الصفحات التي لها عنوان SEO خاص (المنتجات، الفئات، الرئيسية) تتجاوزه.')}</p>
          <div className="space-y-3">
            <label className="block text-sm font-medium">{tb('Title (EN)', 'العنوان (EN)')}
              <input name="titleEn" defaultValue={b.titleEn} className={inputCls} />
            </label>
            <label className="block text-sm font-medium">{tb('Title (AR)', 'العنوان (AR)')}
              <input name="titleAr" defaultValue={b.titleAr} dir="rtl" className={inputCls} />
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-border p-4">
          <h2 className="mb-3 font-heading text-base font-semibold">{tb('Logos', 'الشعارات')}</h2>
          <div className="space-y-5">
            <div>
              <p className="mb-1 text-sm font-medium">{tb('Main logo — light backgrounds', 'الشعار الرئيسي — للخلفيات الفاتحة')}</p>
              <p className="mb-2 text-xs text-muted-foreground">{tb('Shown in the footer and mobile menu (white background). Transparent PNG recommended.', 'يظهر في التذييل وقائمة الموبايل (خلفية بيضاء). يُفضَّل PNG بخلفية شفافة.')}</p>
              <SingleImageUploader name="logoUrl" initial={b.logoUrl} />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">{tb('Light logo — green header', 'الشعار الفاتح — للهيدر الأخضر')}</p>
              <p className="mb-2 text-xs text-muted-foreground">{tb('White/knockout version shown on the green header. If empty, the built-in white Veeey logo is used.', 'نسخة بيضاء تظهر على الهيدر الأخضر. إذا تُرك فارغًا يُستخدم شعار Veeey الأبيض الافتراضي.')}</p>
              <SingleImageUploader name="logoLightUrl" initial={b.logoLightUrl} />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-border p-4">
          <h2 className="mb-3 font-heading text-base font-semibold">{tb('Favicon', 'أيقونة الموقع')}</h2>
          <p className="mb-2 text-xs text-muted-foreground">{tb('The small icon in the browser tab. Upload a square image (PNG/JPG/SVG) — it is converted to a 64×64 PNG automatically.', 'الأيقونة الصغيرة في تبويب المتصفح. ارفع صورة مربعة (PNG/JPG/SVG) — تُحوَّل تلقائيًا إلى PNG بمقاس 64×64.')}</p>
          {b.faviconUrl && (
            <p className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              {tb('Current:', 'الحالية:')} <Image src={b.faviconUrl} alt="" width={20} height={20} unoptimized className="size-5 rounded border border-border" />
            </p>
          )}
          <SingleImageUploader name="faviconUrl" initial={b.faviconUrl} kind="icon" />
        </section>

        <button className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
          {tb('Save branding', 'حفظ الهوية')}
        </button>
      </form>
    </div>
  );
}
