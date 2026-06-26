import { setRequestLocale } from 'next-intl/server';
import { redirect, Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth-guards';
import { hasPermission } from '@/lib/rbac';
import { pick } from '@/lib/admin-i18n';
import { getWooFormValues, getWooConfig, wooOverview } from '@/lib/woocommerce';
import { inputCls, SubmitButton } from '@/components/admin/ui';
import { saveWooConfigAction, clearWooConfigAction } from '@/server/woocommerce-actions';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;

const ENTITIES: { slug: string; en: string; ar: string; countKey: string }[] = [
  { slug: 'products', en: 'Products', ar: 'المنتجات', countKey: 'products' },
  { slug: 'customers', en: 'Customers', ar: 'العملاء', countKey: 'customers' },
  { slug: 'orders', en: 'Orders', ar: 'الطلبات', countKey: 'orders' },
  { slug: 'categories', en: 'Categories', ar: 'الفئات', countKey: 'categories' },
  { slug: 'coupons', en: 'Coupons', ar: 'الكوبونات', countKey: 'coupons' },
  { slug: 'reviews', en: 'Reviews', ar: 'المراجعات', countKey: 'reviews' },
];

export default async function WooConnectionPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });
  if (!user) return null;
  if (!hasPermission(user.permissions, 'settings.manage')) redirect({ href: '/admin', locale });

  const fv = await getWooFormValues();
  const configured = !!(await getWooConfig());
  const overview = configured ? await wooOverview() : null;

  const banner = sp.saved ? tb('Saved.', 'تم الحفظ.') : sp.cleared ? tb('Cleared.', 'تم المسح.') : sp.error ? tb('Save failed.', 'تعذّر الحفظ.') : null;

  const label = 'block text-sm font-medium text-foreground';
  const card = 'rounded-xl border border-border bg-card p-5';

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-2 font-heading text-xl font-semibold text-foreground">{tb('Egypt Vitamins (WooCommerce)', 'إيجيبت فيتامينز (ووكومرس)')}</h1>
      <p className="mb-5 max-w-2xl text-sm text-muted-foreground">
        {tb(
          'Connect to egyptvitamins.com to read products, customers and orders. This is read-only — nothing is written to the source. Generate a read-only REST API key in WooCommerce → Settings → Advanced → REST API.',
          'اتصل بـ egyptvitamins.com لقراءة المنتجات والعملاء والطلبات. القراءة فقط — لا يُكتب أي شيء في المصدر. أنشئ مفتاح REST للقراءة فقط من WooCommerce ← الإعدادات ← متقدّم ← REST API.',
        )}
      </p>
      {banner && <div className={`mb-5 max-w-2xl rounded-lg px-3 py-2 text-sm ${sp.error ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>{banner}</div>}

      <div className="grid max-w-2xl gap-5">
        <section className={card}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">{tb('Connection', 'الاتصال')}</h2>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${configured ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
              {configured ? tb('Configured', 'مُهيّأ') : tb('Not set', 'غير مهيّأ')}
            </span>
          </div>
          <form action={saveWooConfigAction} className="space-y-3">
            <input type="hidden" name="locale" value={locale} />
            <label className={label}>
              {tb('Store URL', 'رابط المتجر')}
              <input name="url" defaultValue={fv.url} placeholder="https://egyptvitamins.com" autoComplete="off" className={inputCls} />
            </label>
            <label className={label}>
              {tb('Consumer key', 'مفتاح المستهلك')}
              <input name="consumerKey" defaultValue={fv.consumerKey} placeholder="ck_…" autoComplete="off" className={`${inputCls} font-mono text-xs`} />
            </label>
            <label className={label}>
              {tb('Consumer secret', 'سر المستهلك')}
              <input name="consumerSecret" type="password" autoComplete="off" placeholder={fv.hasSecret ? '•••••••• ' + tb('(set — leave blank to keep)', '(محفوظ — اتركه فارغًا للإبقاء)') : 'cs_…'} className={`${inputCls} font-mono text-xs`} />
            </label>
            <div className="pt-1"><SubmitButton>{tb('Save & test', 'حفظ واختبار')}</SubmitButton></div>
          </form>
          {configured && (
            <form action={clearWooConfigAction} className="mt-2">
              <input type="hidden" name="locale" value={locale} />
              <button className="text-xs font-medium text-destructive hover:underline">{tb('Disconnect', 'قطع الاتصال')}</button>
            </form>
          )}
        </section>

        {overview && !overview.ok && (
          <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {tb('Connection failed', 'فشل الاتصال')}: <span className="font-mono text-xs">{overview.error}</span>
          </div>
        )}

        {overview?.ok && (
          <section className={card}>
            <h2 className="mb-3 text-base font-semibold text-foreground">{tb('What we can see', 'ما يمكننا رؤيته')}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {ENTITIES.map((e) => {
                const n = overview.counts[e.countKey];
                return (
                  <Link key={e.slug} href={`/admin/woocommerce/${e.slug}`} className="rounded-lg border border-border p-3 transition hover:border-primary">
                    <div className="text-xs text-muted-foreground">{tb(e.en, e.ar)}</div>
                    <div className="mt-0.5 text-xl font-semibold text-foreground">{n == null ? '—' : n.toLocaleString('en-US')}</div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
