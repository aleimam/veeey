import { setRequestLocale } from 'next-intl/server';
import { requirePermission } from '@/lib/auth-guards';
import { pick } from '@/lib/admin-i18n';
import { FEATURES, type FeatureId } from '@/lib/feature-flags';
import { getFeatureStates } from '@/lib/feature-service';
import { saveFeaturesAction } from '@/server/feature-actions';

export const dynamic = 'force-dynamic';
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
type SP = Record<string, string | string[] | undefined>;

export default async function FeaturesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  await requirePermission('settings.manage');
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const ar = locale === 'ar';

  const states = await getFeatureStates();
  const flag = one(sp.saved) ? 'saved' : one(sp.error);
  const onCount = FEATURES.filter((f) => states[f.id] !== false).length;

  // Preserve registry order within each group.
  const groups: { title: string; items: typeof FEATURES }[] = [];
  for (const f of FEATURES) {
    const title = ar ? f.group[1] : f.group[0];
    let g = groups.find((x) => x.title === title);
    if (!g) { g = { title, items: [] }; groups.push(g); }
    g.items.push(f);
  }

  const label = (f: (typeof FEATURES)[number], k: 0 | 1) => (ar ? f[k === 0 ? 'label' : 'description'][1] : f[k === 0 ? 'label' : 'description'][0]);

  return (
    <div className="max-w-3xl p-4 sm:p-6">
      <h1 className="mb-1 font-heading text-xl font-semibold text-foreground">{tb('Features', 'الميزات')}</h1>
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        {tb(
          'Switch customer-facing features on or off. Turning one off hides it everywhere — header, footer, home, product pages — and its own page redirects to the homepage.',
          'شغّل أو أوقف الميزات الموجّهة للعملاء. إيقاف ميزة يخفيها في كل مكان — الرأس والتذييل والصفحة الرئيسية وصفحات المنتج — وتوجّه صفحتها إلى الرئيسية.',
        )}
      </p>

      {flag === 'saved' && <div className="mb-4 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Features updated.', 'تم تحديث الميزات.')}</div>}
      {flag === 'forbidden' && <div className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb("You don't have permission.", 'ليس لديك صلاحية.')}</div>}
      {flag === '1' && <div className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Could not save. Try again.', 'تعذّر الحفظ. حاول مجددًا.')}</div>}

      <form action={saveFeaturesAction}>
        <input type="hidden" name="locale" value={locale} />
        <div className="mb-4 flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2 text-sm">
          <span className="text-muted-foreground">{tb(`${onCount} of ${FEATURES.length} features on`, `${onCount} من ${FEATURES.length} ميزة مفعّلة`)}</span>
          <button type="submit" className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90">{tb('Save changes', 'حفظ التغييرات')}</button>
        </div>

        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.title} className="rounded-xl border border-border bg-card">
              <h2 className="border-b border-border px-4 py-2.5 font-heading text-sm font-semibold text-foreground">{g.title}</h2>
              <ul>
                {g.items.map((f) => {
                  const on = states[f.id as FeatureId] !== false;
                  return (
                    <li key={f.id} className="flex items-start justify-between gap-4 border-b border-border px-4 py-3 last:border-0">
                      <div className="min-w-0">
                        <div className="font-medium text-foreground">{label(f, 0)}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{label(f, 1)}</div>
                      </div>
                      <label className="relative inline-flex shrink-0 cursor-pointer items-center" title={on ? tb('On', 'مفعّل') : tb('Off', 'موقوف')}>
                        <input type="checkbox" name={f.id} value="on" defaultChecked={on} className="peer sr-only" />
                        <span className="h-6 w-11 rounded-full bg-muted transition-colors peer-checked:bg-primary" />
                        <span className="absolute mx-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ltr:left-0 ltr:peer-checked:translate-x-5 rtl:right-0 rtl:peer-checked:-translate-x-5" />
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <button type="submit" className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90">{tb('Save changes', 'حفظ التغييرات')}</button>
        </div>
      </form>
    </div>
  );
}
