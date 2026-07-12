import { setRequestLocale } from 'next-intl/server';
import { requirePermission } from '@/lib/auth-guards';
import { pick } from '@/lib/admin-i18n';
import { inputCls } from '@/components/admin/ui';
import { getTrustpilotConfig } from '@/lib/trustpilot-service';
import { TP_TEMPLATES, tpConfigured, type TpPlacement } from '@/lib/trustpilot-config';
import { saveTrustpilotAction } from '@/server/trustpilot-actions';

export const dynamic = 'force-dynamic';
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
type SP = Record<string, string | string[] | undefined>;

export default async function TrustpilotPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  await requirePermission('settings.manage');
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const ar = locale === 'ar';

  const cfg = await getTrustpilotConfig();
  const flag = one(sp.saved) ? 'saved' : one(sp.error);
  const configured = tpConfigured(cfg);
  const label = 'mb-1 block text-xs font-medium text-muted-foreground';
  const card = 'rounded-xl border border-border bg-card p-4';

  const placementCard = (p: TpPlacement, titleEn: string, titleAr: string) => {
    const pc = cfg[p];
    return (
      <div className={card} key={p}>
        <label className="flex items-center gap-2 font-heading text-sm font-semibold text-foreground">
          <input type="checkbox" name={`${p}.enabled`} defaultChecked={pc.enabled} /> {tb(titleEn, titleAr)}
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label}>{tb('Template', 'القالب')}</label>
            <select name={`${p}.template`} defaultValue={pc.template} className={inputCls}>
              {TP_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{ar ? t.ar : t.en}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>{tb('Height (px)', 'الارتفاع (بكسل)')}</label>
            <input name={`${p}.height`} type="number" min={16} max={600} defaultValue={pc.height} className={inputCls} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-3xl p-4 sm:p-6">
      <h1 className="mb-1 font-heading text-xl font-semibold text-foreground">{tb('Trustpilot reviews', 'مراجعات Trustpilot')}</h1>
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        {tb(
          'Show your Trustpilot rating on the storefront. Paste your Business Unit ID from the Trustpilot Business dashboard (Integrations → TrustBox). Nothing appears until an ID is set.',
          'اعرض تقييم Trustpilot على المتجر. الصق معرّف وحدة عملك من لوحة Trustpilot (التكاملات ← TrustBox). لا شيء يظهر قبل إدخال المعرّف.',
        )}
      </p>

      {flag === 'saved' && <div className="mb-4 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Saved.', 'تم الحفظ.')}</div>}
      {flag === 'forbidden' && <div className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb("You don't have permission.", 'ليس لديك صلاحية.')}</div>}
      {flag === '1' && <div className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Could not save.', 'تعذّر الحفظ.')}</div>}
      {!configured && (
        <div className="mb-4 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
          {tb('Inactive — add a Business Unit ID below to start showing reviews.', 'غير مُفعّل — أضف معرّف وحدة العمل بالأسفل لبدء عرض المراجعات.')}
        </div>
      )}

      <form action={saveTrustpilotAction} className="space-y-4">
        <input type="hidden" name="locale" value={locale} />

        <div className={card}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={label}>{tb('Business Unit ID', 'معرّف وحدة العمل')}</label>
              <input name="businessUnitId" defaultValue={cfg.businessUnitId} className={inputCls} placeholder="e.g. 5f2a…" />
            </div>
            <div>
              <label className={label}>{tb('Review domain', 'نطاق المراجعة')}</label>
              <input name="domain" defaultValue={cfg.domain} className={inputCls} placeholder="veeey.com" />
            </div>
            <div>
              <label className={label}>{tb('Widget locale', 'لغة الأداة')}</label>
              <input name="tpLocale" defaultValue={cfg.locale} className={inputCls} placeholder="en-US" />
            </div>
            <div>
              <label className={label}>{tb('Theme', 'السمة')}</label>
              <select name="theme" defaultValue={cfg.theme} className={inputCls}>
                <option value="light">{tb('Light', 'فاتح')}</option>
                <option value="dark">{tb('Dark', 'داكن')}</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {placementCard('home', 'Homepage', 'الصفحة الرئيسية')}
          {placementCard('footer', 'Footer', 'التذييل')}
          {placementCard('checkout', 'Checkout', 'الدفع')}
        </div>

        <button type="submit" className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90">{tb('Save', 'حفظ')}</button>
      </form>
    </div>
  );
}
