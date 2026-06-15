import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { HOME_FIELDS, FEATURED_KEY, getHomeRaw } from '@/lib/home-content-service';
import { listCollections } from '@/lib/content-service';
import { saveHomeContentAction } from '@/server/home-actions';
import { inputCls } from '@/components/admin/ui';
import { pick } from '@/lib/admin-i18n';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function HomepageAdmin({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const [values, collections] = await Promise.all([getHomeRaw(), listCollections()]);

  return (
    <div className="p-6">
      <h1 className="mb-1 font-heading text-xl font-semibold">{tb('Homepage content', 'محتوى الصفحة الرئيسية')}</h1>
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        {tb('Edit the hero section and announcement bar. Leave a field empty to use the default text. The page layout is fixed; this only changes the wording.', 'عدّل القسم الرئيسي وشريط الإعلان. اترك الحقل فارغًا لاستخدام النص الافتراضي. تخطيط الصفحة ثابت؛ هذا يغيّر الصياغة فقط.')}
      </p>
      <div className="mb-6 flex gap-3 text-sm">
        <Link href="/admin/homepage/testimonials" className="rounded-md border border-border px-3 py-1.5 hover:bg-surface">{tb('Manage customer reviews →', 'إدارة آراء العملاء →')}</Link>
        <Link href="/admin/homepage/trust" className="rounded-md border border-border px-3 py-1.5 hover:bg-surface">{tb('Manage trust badges →', 'إدارة شارات الثقة →')}</Link>
      </div>

      {one(sp.saved) === '1' && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Saved.', 'تم الحفظ.')}</p>}
      {one(sp.error) === '1' && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Could not save.', 'تعذّر الحفظ.')}</p>}

      <form action={saveHomeContentAction} className="max-w-3xl space-y-6">
        <input type="hidden" name="locale" value={locale} />

        <div className="rounded-lg border border-border p-4">
          <p className="mb-2 text-sm font-semibold">{tb('Featured row (best sellers)', 'الصف المميّز (الأكثر مبيعًا)')}</p>
          <label className="block text-sm font-medium">{tb('Source collection', 'المجموعة المصدر')}
            <select name={FEATURED_KEY} defaultValue={values[FEATURED_KEY] ?? ''} className={inputCls}>
              <option value="">{tb('Automatic — most popular', 'تلقائي — الأكثر شيوعًا')}</option>
              {collections.map((c) => <option key={c.id} value={c.id}>{c.titleEn}</option>)}
            </select>
            <span className="mt-1 block text-xs font-normal text-muted-foreground">{tb('Choose a collection to feature, or leave it on automatic (top-rated products).', 'اختر مجموعة لإبرازها، أو اتركها على الوضع التلقائي (المنتجات الأعلى تقييمًا).')}</span>
          </label>
        </div>

        {HOME_FIELDS.map((f) => (
          <div key={f.key} className="rounded-lg border border-border p-4">
            <p className="mb-2 text-sm font-semibold">{f.label}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">{tb('English', 'إنجليزي')}
                {f.multiline
                  ? <textarea name={`${f.key}.en`} defaultValue={values[`${f.key}.en`] ?? ''} rows={3} className={inputCls} />
                  : <input name={`${f.key}.en`} defaultValue={values[`${f.key}.en`] ?? ''} className={inputCls} />}
              </label>
              <label className="text-sm font-medium">{tb('Arabic', 'العربية')}
                {f.multiline
                  ? <textarea name={`${f.key}.ar`} defaultValue={values[`${f.key}.ar`] ?? ''} rows={3} dir="rtl" className={inputCls} />
                  : <input name={`${f.key}.ar`} defaultValue={values[`${f.key}.ar`] ?? ''} dir="rtl" className={inputCls} />}
              </label>
            </div>
          </div>
        ))}
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">{tb('Save homepage', 'حفظ الصفحة الرئيسية')}</button>
      </form>
    </div>
  );
}
