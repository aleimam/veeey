import { setRequestLocale } from 'next-intl/server';
import { Link, redirect } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth-guards';
import { hasPermission } from '@/lib/rbac';
import { pick } from '@/lib/admin-i18n';
import { prisma } from '@/lib/prisma';
import { getBranding } from '@/lib/branding-service';
import { getWatermarkSettings, getLastRun } from '@/lib/watermark-service';
import { WatermarkStudio } from '@/components/admin/watermark-studio';
import { WatermarkBatch } from '@/components/admin/watermark-batch';

export const dynamic = 'force-dynamic';
type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function WatermarkPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });
  if (!user) return null;
  if (!hasPermission(user.permissions, 'catalog.write')) redirect({ href: '/admin', locale });

  const [settings, branding, sample, categories, brands, collections, lastRun, stampedCount, totalCount] = await Promise.all([
    getWatermarkSettings(),
    getBranding(),
    prisma.productImage.findFirst({ where: { originalUrl: null, url: { not: { endsWith: '__wm.webp' } } }, orderBy: { isPrimary: 'desc' }, select: { url: true } }),
    prisma.category.findMany({ orderBy: { nameEn: 'asc' }, select: { id: true, nameEn: true } }),
    prisma.brand.findMany({ where: { archivedAt: null }, orderBy: { nameEn: 'asc' }, select: { id: true, nameEn: true } }),
    prisma.collection.findMany({ orderBy: { titleEn: 'asc' }, select: { id: true, titleEn: true } }),
    getLastRun(),
    prisma.productImage.count({ where: { OR: [{ originalUrl: { not: null } }, { url: { endsWith: '__wm.webp' } }] } }),
    prisma.productImage.count(),
  ]);

  const date = (iso?: string) => (iso ? new Date(iso).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-GB') : '—');

  return (
    <div className="max-w-4xl p-6">
      <h1 className="mb-1 font-heading text-xl font-semibold">{tb('Product photo watermark', 'العلامة المائية لصور المنتجات')}</h1>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        {tb('Stamp your logo onto product photos. Originals are never overwritten — you can re-stamp with new settings or remove the watermark anytime.', 'اطبع شعارك على صور المنتجات. لا تُستبدل الأصول أبدًا — يمكنك إعادة الختم بإعدادات جديدة أو إزالة العلامة في أي وقت.')}
        {' '}<Link href="/admin/branding" className="text-primary hover:underline">{tb('Manage logos →', 'إدارة الشعارات →')}</Link>
      </p>

      {one(sp.saved) != null && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Settings saved ✓', 'تم حفظ الإعدادات ✓')}</p>}
      {one(sp.started) != null && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{one(sp.started) === 'remove' ? tb('Removing watermarks in the background…', 'جارٍ إزالة العلامات في الخلفية…') : tb('Watermarking in the background… refresh in a moment to see progress.', 'جارٍ الختم في الخلفية… حدّث بعد لحظات لرؤية التقدّم.')}</p>}

      <section className="mb-8">
        <WatermarkStudio locale={locale} initial={settings} sampleImage={sample?.url ?? null}
          logos={{ icon: branding.logoIconUrl, horizontal: branding.logoUrl, transparent: branding.logoLightUrl }} />
      </section>

      <section className="mb-6">
        <h2 className="mb-1 font-heading text-lg font-semibold">{tb('Apply to your catalog', 'التطبيق على الكتالوج')}</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          {tb(`${stampedCount} of ${totalCount} product images are currently watermarked.`, `${stampedCount} من ${totalCount} صورة منتج مختومة حاليًا.`)}
          {lastRun && <> {tb('Last run:', 'آخر تشغيل:')} {tb(lastRun.action === 'remove' ? 'removed' : 'stamped', lastRun.action === 'remove' ? 'إزالة' : 'ختم')} {lastRun.done}/{lastRun.total} {lastRun.failed ? `(${lastRun.failed} ${tb('failed', 'فشل')})` : ''} · {date(lastRun.at)}{lastRun.error ? ` · ${lastRun.error}` : ''}</>}
        </p>
        <WatermarkBatch locale={locale}
          categories={categories.map((c) => ({ id: c.id, name: c.nameEn }))}
          brands={brands.map((b) => ({ id: b.id, name: b.nameEn }))}
          collections={collections.map((c) => ({ id: c.id, name: c.titleEn }))} />
      </section>
    </div>
  );
}
