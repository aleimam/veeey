import { setRequestLocale } from 'next-intl/server';
import { redirect, Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth-guards';
import { hasPermission } from '@/lib/rbac';
import { pick } from '@/lib/admin-i18n';
import { wooConfigured } from '@/lib/woocommerce';
import { dryRun, type DryRunEntity } from '@/lib/migration/wc-dry-run';
import type { FlagCode } from '@/lib/migration/wc-transform';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;

const ENTITIES: { slug: DryRunEntity; en: string; ar: string }[] = [
  { slug: 'products', en: 'Products', ar: 'المنتجات' },
  { slug: 'customers', en: 'Customers', ar: 'العملاء' },
  { slug: 'orders', en: 'Orders', ar: 'الطلبات' },
];

const FLAG: Record<FlagCode, { en: string; ar: string; bucket: string }> = {
  sku_regenerated: { en: 'SKU will be regenerated', ar: 'سيُعاد توليد SKU', bucket: '⤵' },
  kind_unknown: { en: 'Product kind needs classifying', ar: 'يلزم تصنيف نوع المنتج', bucket: '⚠' },
  missing_ar: { en: 'No Arabic name (translate)', ar: 'لا يوجد اسم عربي (ترجمة)', bucket: '⚠' },
  missing_weight: { en: 'Missing weight', ar: 'الوزن مفقود', bucket: '⚠' },
  missing_gtin: { en: 'Missing GTIN / barcode', ar: 'باركود مفقود', bucket: '⚠' },
  sale_to_lot: { en: 'Sale price → moves to a lot', ar: 'سعر التخفيض ← ينتقل لدفعة', bucket: '⤵' },
  status_draft: { en: 'Draft in WooCommerce', ar: 'مسودة في ووكومرس', bucket: '⤵' },
  categories_over_max: { en: 'More than 4 categories', ar: 'أكثر من 4 فئات', bucket: '⤵' },
  password_not_migratable: { en: 'Password cannot migrate (reset / OTP)', ar: 'لا يمكن نقل كلمة المرور', bucket: '✖' },
  missing_phone: { en: 'Missing phone', ar: 'الهاتف مفقود', bucket: '⚠' },
  missing_city: { en: 'Missing city', ar: 'المدينة مفقودة', bucket: '⚠' },
  currency_not_egp: { en: 'Currency not EGP', ar: 'العملة ليست ج.م', bucket: '⚠' },
  guest_order: { en: 'Guest order (no account)', ar: 'طلب زائر (بلا حساب)', bucket: '⤵' },
  status_unmapped: { en: 'Custom status → needs mapping', ar: 'حالة مخصّصة ← تحتاج خريطة', bucket: '⚠' },
  no_lot_binding: { en: 'No historical lot / expiry binding', ar: 'لا ربط دفعة/صلاحية تاريخي', bucket: '⤵' },
  validation_error: { en: 'Validation error (would skip)', ar: 'خطأ تحقّق (سيُتخطّى)', bucket: '✖' },
};

export default async function ImportDryRunPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });
  if (!user) return null;
  if (!hasPermission(user.permissions, 'settings.manage')) redirect({ href: '/admin', locale });

  const configured = await wooConfigured();
  const runRaw = Array.isArray(sp.run) ? sp.run[0] : sp.run;
  const run = ENTITIES.some((e) => e.slug === runRaw) ? (runRaw as DryRunEntity) : null;
  const pages = Math.min(50, Math.max(1, Number(Array.isArray(sp.pages) ? sp.pages[0] : sp.pages) || 10));
  const report = run && configured ? await dryRun(run, pages) : null;

  const card = 'rounded-xl border border-border bg-card p-5';
  const runHref = (slug: string, p = 10) => `/admin/woocommerce/import?run=${slug}&pages=${p}`;

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-2 font-heading text-xl font-semibold text-foreground">{tb('Import dry-run', 'تجربة الاستيراد')}</h1>
      <p className="mb-5 max-w-2xl text-sm text-muted-foreground">
        {tb(
          'Preview what an import from Egypt Vitamins would do — transforms, gaps, and decisions — without writing anything to Veeey. Run a sample first; a full scan is a later background job.',
          'عاين ما سيفعله الاستيراد من إيجيبت فيتامينز — التحويلات والفجوات والقرارات — دون كتابة أي شيء في Veeey. شغّل عيّنة أولًا؛ المسح الكامل مهمة خلفية لاحقة.',
        )}
      </p>

      {!configured ? (
        <div className="rounded-lg bg-destructive/10 px-3 py-3 text-sm text-destructive">
          {tb('Not connected. ', 'لم يتم الاتصال. ')}
          <Link href="/admin/woocommerce" className="font-medium underline">{tb('Set up the connection first', 'أعدّ الاتصال أولًا')}</Link>.
        </div>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap gap-2">
            {ENTITIES.map((e) => (
              <Link
                key={e.slug}
                href={runHref(e.slug)}
                className={`rounded-md border px-3 py-2 text-sm ${run === e.slug ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-surface'}`}
              >
                {tb(`Dry-run ${e.en}`, `تجربة ${e.ar}`)}
              </Link>
            ))}
          </div>

          {report && (
            <div className={card}>
              {report.error ? (
                <div className="text-sm text-destructive">{tb('Scan failed', 'فشل المسح')}: <span className="font-mono text-xs">{report.error}</span></div>
              ) : (
                <>
                  <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <h2 className="text-base font-semibold text-foreground">{tb(`${report.entity} report`, `تقرير ${report.entity}`)}</h2>
                    <div className="text-sm text-muted-foreground">
                      {tb(`Sampled ${report.scanned.toLocaleString('en-US')} of ${report.total.toLocaleString('en-US')}`, `عُيّنت ${report.scanned.toLocaleString('en-US')} من ${report.total.toLocaleString('en-US')}`)}
                      {report.truncated && <Link href={runHref(report.entity, 50)} className="ms-2 text-primary hover:underline">{tb('scan more', 'مسح أكثر')}</Link>}
                    </div>
                  </div>

                  <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <Stat label={tb('Scanned', 'المفحوص')} value={report.scanned} />
                    <Stat label={tb('Valid', 'صالح')} value={report.valid} tone="text-primary" />
                    <Stat label={tb('Would skip', 'سيُتخطّى')} value={report.errors} tone={report.errors ? 'text-destructive' : undefined} />
                  </div>

                  <h3 className="mb-2 text-sm font-semibold text-foreground">{tb('What import would do', 'ما سيفعله الاستيراد')}</h3>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                        <tr><th className="p-2.5 text-start font-medium">{tb('Finding', 'الملاحظة')}</th><th className="p-2.5 text-start font-medium">{tb('Count', 'العدد')}</th><th className="p-2.5 text-start font-medium">{tb('Examples', 'أمثلة')}</th></tr>
                      </thead>
                      <tbody>
                        {report.flags.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">{tb('No findings.', 'لا ملاحظات.')}</td></tr>}
                        {report.flags.map((f) => {
                          const meta = FLAG[f.code];
                          return (
                            <tr key={f.code} className="border-t border-border">
                              <td className="p-2.5 text-foreground"><span className="me-1.5">{meta.bucket}</span>{tb(meta.en, meta.ar)}</td>
                              <td className="p-2.5 font-medium text-foreground">{f.count.toLocaleString('en-US')}</td>
                              <td className="p-2.5 font-mono text-xs text-muted-foreground">{f.samples.join(', ')}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {report.distinct.map((d) => (
                    <div key={d.label[0]} className="mt-5">
                      <h3 className="mb-2 text-sm font-semibold text-foreground">{tb(d.label[0], d.label[1])} <span className="font-normal text-muted-foreground">({d.values.length})</span></h3>
                      <div className="flex flex-wrap gap-1.5">
                        {d.values.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
                        {d.values.map((v) => (
                          <span key={v.value} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs text-foreground">
                            {v.value} <span className="text-muted-foreground">{v.count}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}

                  {report.sampleErrors.length > 0 && (
                    <div className="mt-5">
                      <h3 className="mb-2 text-sm font-semibold text-destructive">{tb('Sample skipped records', 'أمثلة على سجلات متخطّاة')}</h3>
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        {report.sampleErrors.map((e, i) => <li key={i}><span className="font-mono">{e.key}</span> — {e.detail}</li>)}
                      </ul>
                    </div>
                  )}

                  <p className="mt-5 text-xs text-muted-foreground">{tb('Nothing was written. This is analysis only.', 'لم يُكتب أي شيء. هذا تحليل فقط.')}</p>
                </>
              )}
            </div>
          )}

          {!report && <p className="text-sm text-muted-foreground">{tb('Pick an entity above to run a read-only preview.', 'اختر كيانًا أعلاه لتشغيل معاينة للقراءة فقط.')}</p>}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-xl font-semibold ${tone ?? 'text-foreground'}`}>{value.toLocaleString('en-US')}</div>
    </div>
  );
}
