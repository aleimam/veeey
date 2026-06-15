import { setRequestLocale } from 'next-intl/server';
import { HOME_FIELDS, getHomeRaw } from '@/lib/home-content-service';
import { saveHomeContentAction } from '@/server/home-actions';
import { inputCls } from '@/components/admin/ui';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function HomepageAdmin({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const values = await getHomeRaw();

  return (
    <div className="p-6">
      <h1 className="mb-1 font-heading text-xl font-semibold">Homepage content</h1>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        Edit the hero and announcement bar. Leave a field blank to use the default text. The page layout is fixed; this changes the wording only.
      </p>

      {one(sp.saved) === '1' && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">Saved.</p>}
      {one(sp.error) === '1' && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">Could not save.</p>}

      <form action={saveHomeContentAction} className="max-w-3xl space-y-6">
        <input type="hidden" name="locale" value={locale} />
        {HOME_FIELDS.map((f) => (
          <div key={f.key} className="rounded-lg border border-border p-4">
            <p className="mb-2 text-sm font-semibold">{f.label}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">English
                {f.multiline
                  ? <textarea name={`${f.key}.en`} defaultValue={values[`${f.key}.en`] ?? ''} rows={3} className={inputCls} />
                  : <input name={`${f.key}.en`} defaultValue={values[`${f.key}.en`] ?? ''} className={inputCls} />}
              </label>
              <label className="text-sm font-medium">العربية
                {f.multiline
                  ? <textarea name={`${f.key}.ar`} defaultValue={values[`${f.key}.ar`] ?? ''} rows={3} dir="rtl" className={inputCls} />
                  : <input name={`${f.key}.ar`} defaultValue={values[`${f.key}.ar`] ?? ''} dir="rtl" className={inputCls} />}
              </label>
            </div>
          </div>
        ))}
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">Save homepage</button>
      </form>
    </div>
  );
}
