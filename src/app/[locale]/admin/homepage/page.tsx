import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getHomeLayout } from '@/lib/home-layout-service';
import { listCollections } from '@/lib/content-service';
import { HomeBuilder } from '@/components/admin/home-builder';
import { pick } from '@/lib/admin-i18n';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function HomepageAdmin({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const [blocks, collections] = await Promise.all([getHomeLayout(), listCollections()]);

  return (
    <div className="p-6">
      <h1 className="mb-1 font-heading text-xl font-semibold">{tb('Homepage builder', 'منشئ الصفحة الرئيسية')}</h1>
      <p className="mb-4 max-w-3xl text-sm text-muted-foreground">
        {tb('Show/hide any section, drag the order with ▲▼, and add gadgets (rich content, banners, product rows, CTAs, tiles). Click Save to publish.', 'أظهر/أخفِ أي قسم، رتّب باستخدام ▲▼، وأضف عناصر (محتوى منسّق، بانرات، صفوف منتجات، دعوات لإجراء، بطاقات). اضغط حفظ للنشر.')}
      </p>
      <div className="mb-5 flex flex-wrap gap-3 text-sm">
        <Link href="/admin/homepage/testimonials" className="rounded-md border border-border px-3 py-1.5 hover:bg-surface">{tb('Customer reviews →', 'آراء العملاء →')}</Link>
        <Link href="/admin/homepage/trust" className="rounded-md border border-border px-3 py-1.5 hover:bg-surface">{tb('Trust badges →', 'شارات الثقة →')}</Link>
        <Link href="/admin/appearance" className="rounded-md border border-border px-3 py-1.5 hover:bg-surface">{tb('Theme & colours →', 'الثيم والألوان →')}</Link>
      </div>

      {one(sp.saved) === '1' && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Homepage saved.', 'تم حفظ الصفحة الرئيسية.')}</p>}
      {one(sp.error) === '1' && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Could not save.', 'تعذّر الحفظ.')}</p>}

      <HomeBuilder locale={locale} initialBlocks={blocks} collections={collections.map((c) => ({ id: c.id, title: c.titleEn }))} />
    </div>
  );
}
