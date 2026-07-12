import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getHomeLayout } from '@/lib/home-layout-service';
import { listCollections } from '@/lib/content-service';
import { getHomeRaw } from '@/lib/home-content-service';
import { saveAnnouncementAction } from '@/server/home-actions';
import { HomeBuilder } from '@/components/admin/home-builder';
import { inputCls } from '@/components/admin/ui';
import { pick } from '@/lib/admin-i18n';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function HomepageAdmin({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const [blocks, collections, homeRaw] = await Promise.all([getHomeLayout(), listCollections(), getHomeRaw()]);
  const announcementOn = homeRaw['home.announcementEnabled'] !== 'false';

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

      {/* Announcement bar (the promo pill above the header) — show/hide + text. */}
      <section className="mb-6 max-w-3xl rounded-lg border border-border p-4">
        <h2 className="mb-1 font-heading text-base font-semibold">{tb('Announcement bar', 'شريط الإعلان')}</h2>
        <p className="mb-3 text-xs text-muted-foreground">{tb('The promo pill above the header. Turn it off to hide it site-wide, or leave the text blank to use the default offer.', 'الشريط الترويجي أعلى الهيدر. أطفئه لإخفائه في كل الموقع، أو اترك النص فارغًا لاستخدام العرض الافتراضي.')}</p>
        <form action={saveAnnouncementAction} className="space-y-3">
          <input type="hidden" name="locale" value={locale} />
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="announcementEnabled" defaultChecked={announcementOn} className="size-4" />
            {tb('Show the announcement bar', 'إظهار شريط الإعلان')}
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">{tb('Text (English)', 'النص (بالإنجليزية)')}
              <input name="announcementEn" defaultValue={homeRaw['home.announcement.en'] ?? ''} placeholder={tb('Free EGP 100 gift card…', '…')} className={inputCls} />
            </label>
            <label className="text-sm font-medium">{tb('Text (Arabic)', 'النص (بالعربية)')}
              <input name="announcementAr" defaultValue={homeRaw['home.announcement.ar'] ?? ''} dir="rtl" className={inputCls} />
            </label>
          </div>
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{tb('Save announcement', 'حفظ الإعلان')}</button>
        </form>
      </section>

      <HomeBuilder locale={locale} initialBlocks={blocks} collections={collections.map((c) => ({ id: c.id, title: c.titleEn }))} />
    </div>
  );
}
