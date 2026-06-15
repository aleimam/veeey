import { setRequestLocale } from 'next-intl/server';
import { SETTINGS, getAllSettings } from '@/lib/settings-service';
import { saveSettingsAction } from '@/server/settings-actions';
import { Field, inputCls } from '@/components/admin/ui';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function SettingsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const values = await getAllSettings();

  // Group settings for display, preserving registry order.
  const groups: { name: string; items: typeof SETTINGS }[] = [];
  for (const s of SETTINGS) {
    let g = groups.find((x) => x.name === s.group);
    if (!g) { g = { name: s.group, items: [] }; groups.push(g); }
    g.items.push(s);
  }

  return (
    <div className="p-6">
      <h1 className="mb-2 font-heading text-xl font-semibold">Settings</h1>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        Business constants used across the store. Changes apply immediately; defaults are used until overridden.
      </p>

      {one(sp.saved) === '1' && (
        <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">Settings saved.</p>
      )}
      {one(sp.error) === '1' && (
        <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">Could not save. Please try again.</p>
      )}

      <form action={saveSettingsAction} className="max-w-2xl space-y-8">
        <input type="hidden" name="locale" value={locale} />
        {groups.map((g) => (
          <section key={g.name}>
            <h2 className="mb-3 font-heading text-lg font-semibold">{g.name}</h2>
            <div className="space-y-4 rounded-lg border border-border p-4">
              {g.items.map((s) => (
                <Field key={s.key} label={s.label} hint={s.hint}>
                  <input
                    name={s.key}
                    type={s.type === 'text' ? 'text' : 'number'}
                    min={s.type === 'text' ? undefined : 0}
                    defaultValue={values[s.key] ?? s.default}
                    className={inputCls}
                  />
                </Field>
              ))}
            </div>
          </section>
        ))}
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
          Save settings
        </button>
      </form>
    </div>
  );
}
