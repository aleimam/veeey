import { headers } from 'next/headers';
import { setRequestLocale } from 'next-intl/server';
import { redirect, Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth-guards';
import { hasPermission } from '@/lib/rbac';
import { pick } from '@/lib/admin-i18n';
import { wooConfigured, getSyncSettings } from '@/lib/woocommerce';
import { getSyncState } from '@/lib/migration/wc-sync';
import { SubmitButton, inputCls } from '@/components/admin/ui';
import { syncProductsAction, syncCustomersAction, syncOrdersAction, syncReviewsAction, saveSyncSettingsAction, syncEverythingAction } from '@/server/woocommerce-sync-actions';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const res = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
const SKIP_REASON: Record<string, [string, string]> = {
  arabic_only: ['Arabic-only name (no English)', 'اسم عربي فقط (بدون إنجليزي)'],
  condition_tag: ['Open / damaged / broken', 'مفتوح / تالف / مكسور'],
  no_real_name: ['No real name / junk', 'بلا اسم حقيقي / غير صالح'],
};

const ENTITIES = [
  { slug: 'products', en: 'Products', ar: 'المنتجات', action: syncProductsAction, note: ['Incremental — only products changed since the last run.', 'تزايدي — فقط ما تغيّر منذ آخر تشغيل.'] as const },
  { slug: 'orders', en: 'Orders', ar: 'الطلبات', action: syncOrdersAction, note: ['Incremental — only orders changed since the last run.', 'تزايدي — فقط ما تغيّر منذ آخر تشغيل.'] as const },
  { slug: 'customers', en: 'Customers', ar: 'العملاء', action: syncCustomersAction, note: ['Bulk re-scan (WooCommerce has no “changed since” filter for customers) — best for the first full pull.', 'مسح شامل (لا يوفّر ووكومرس مرشّح تغيير للعملاء) — الأفضل للسحب الأول.'] as const },
  { slug: 'reviews', en: 'Reviews', ar: 'التقييمات', action: syncReviewsAction, note: ['Seeds real product reviews so pages stop showing “(0)”. Approved reviews go live immediately; product star ratings recompute automatically.', 'يستورد تقييمات المنتجات الحقيقية لتختفي «(0)». التقييمات المعتمدة تظهر فورًا وتُحدَّث نجوم المنتجات تلقائيًا.'] as const },
] as const;

export default async function WooSyncPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });
  if (!user) return null;
  if (!hasPermission(user.permissions, 'settings.manage')) redirect({ href: '/admin', locale });

  const configured = await wooConfigured();
  const [states, settings] = await Promise.all([
    configured ? Promise.all(ENTITIES.map((e) => getSyncState(e.slug))) : Promise.resolve([]),
    configured ? getSyncSettings() : Promise.resolve(null),
  ]);
  const h = await headers();
  const origin = `${(h.get('x-forwarded-proto') ?? 'https').split(',')[0]}://${h.get('host') ?? 'veeey.com'}`;

  const card = 'rounded-xl border border-border bg-card p-5';
  const ran = one(sp.ran);

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-2 font-heading text-xl font-semibold text-foreground">{tb('Live sync', 'المزامنة الحية')}</h1>
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        {tb(
          'Pull changes from Egypt Vitamins into Veeey. Conflict policy: a record syncs until you edit it in Veeey, then it detaches and sync leaves it alone. New products arrive as draft/PRIVATE.',
          'اسحب التغييرات من إيجيبت فيتامينز إلى Veeey. سياسة التعارض: يُزامَن السجل حتى تعدّله في Veeey ثم ينفصل. المنتجات الجديدة تصل كمسودة/خاصة.',
        )}
      </p>
      <div className="mb-5 max-w-2xl rounded-lg border border-gold/40 bg-gold/10 p-3 text-xs text-foreground">
        {tb(
          '⚠ Writes to Veeey’s database. To import EVERYTHING: each run pulls pages for up to ~2 min and saves progress after every page — so even if it times out, nothing is lost. Just keep clicking “Sync now” until “created” reaches 0. Products & orders resume via a changed-since cursor; customers advance through the full list page by page.',
          '⚠ يكتب في قاعدة بيانات Veeey. لاستيراد كل شيء: كل تشغيل يسحب صفحات حتى ~دقيقتين ويحفظ التقدّم بعد كل صفحة — حتى لو انتهت المهلة لا يضيع شيء. استمر بالضغط على «زامن الآن» حتى يصل «مُنشأ» إلى 0. المنتجات والطلبات تستأنف عبر مؤشر التغيير؛ والعملاء يتقدّمون عبر القائمة كاملةً صفحةً صفحة.',
        )}
      </div>

      {one(sp.error) && <div className="mb-5 max-w-2xl rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Action failed.', 'فشل الإجراء.')}</div>}
      {one(sp.settings) && <div className="mb-5 max-w-2xl rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Settings saved.', 'تم حفظ الإعدادات.')}</div>}
      {one(sp.full) && <div className="mb-5 max-w-2xl rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Full sync started in the background. Refresh this page to watch the counts below climb; it stops automatically when everything is drained.', 'بدأت المزامنة الكاملة في الخلفية. حدّث الصفحة لمتابعة الأعداد؛ تتوقف تلقائيًا عند اكتمال كل شيء.')}</div>}
      {ran && (
        <div className="mb-5 max-w-2xl rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
          {tb(
            `Synced ${ran} — scanned ${one(sp.scanned) ?? 0}, created ${one(sp.created) ?? 0}, updated ${one(sp.updated) ?? 0}, kept ${one(sp.detached) ?? 0}, skipped ${one(sp.skipped) ?? 0}, errors ${one(sp.errors) ?? 0}.`,
            `تمّت مزامنة ${ran} — مفحوص ${one(sp.scanned) ?? 0}، مُنشأ ${one(sp.created) ?? 0}، محدَّث ${one(sp.updated) ?? 0}، مُبقى ${one(sp.detached) ?? 0}، متخطّى ${one(sp.skipped) ?? 0}، أخطاء ${one(sp.errors) ?? 0}.`,
          )}
        </div>
      )}

      {!configured ? (
        <div className="rounded-lg bg-destructive/10 px-3 py-3 text-sm text-destructive">
          {tb('Not connected. ', 'لم يتم الاتصال. ')}
          <Link href="/admin/woocommerce" className="font-medium underline">{tb('Set up the connection first', 'أعدّ الاتصال أولًا')}</Link>.
        </div>
      ) : (
        <div className="grid max-w-2xl gap-5">
          <form action={syncEverythingAction} className="rounded-xl border border-primary/40 bg-primary/5 p-5">
            <input type="hidden" name="locale" value={locale} />
            <h2 className="mb-1 text-base font-semibold text-foreground">{tb('Sync everything', 'مزامنة كل شيء')}</h2>
            <p className="mb-3 text-sm text-muted-foreground">{tb('One click — drains products, orders and customers to completion in the background (on the worker), then stops by itself. Best for a full catch-up. Refresh this page to watch the per-entity counts below.', 'بنقرة واحدة — يسحب المنتجات والطلبات والعملاء بالكامل في الخلفية (على العامل) ثم يتوقف تلقائيًا. حدّث الصفحة لمتابعة الأعداد بالأسفل.')}</p>
            <SubmitButton>{tb('Sync everything now', 'مزامنة كل شيء الآن')}</SubmitButton>
            <p className="mt-2 text-xs text-muted-foreground">{tb('Requires the background worker to be running.', 'يتطلب تشغيل عامل الخلفية.')}</p>
          </form>
          {ENTITIES.map((e, i) => {
            const st = states[i];
            const last = res(st?.lastResult);
            return (
              <section key={e.slug} className={card}>
                <h2 className="mb-1 text-base font-semibold text-foreground">{tb(e.en, e.ar)}</h2>
                <p className="mb-3 text-sm text-muted-foreground">{tb(e.note[0], e.note[1])}</p>
                <form action={e.action} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="locale" value={locale} />
                  <label className="text-sm text-foreground">
                    {tb('Max pages this run', 'أقصى صفحات لكل تشغيل')}
                    <select name="pages" defaultValue="25" className={`${inputCls} mt-1 w-auto`}>
                      {[5, 10, 25, 50, 100, 200, 400].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                  <SubmitButton>{tb('Sync now', 'زامن الآن')}</SubmitButton>
                </form>
                <p className="mt-3 text-xs text-muted-foreground">
                  {tb('Last run', 'آخر تشغيل')}: {st?.lastRunAt ? new Date(st.lastRunAt).toISOString().replace('T', ' ').slice(0, 16) : '—'}
                  {' · '}{tb('created', 'مُنشأ')} {String(last.created ?? '—')} · {tb('updated', 'محدَّث')} {String(last.updated ?? '—')} · {tb('skipped', 'متخطّى')} {String(last.skipped ?? '—')} · {tb('errors', 'أخطاء')} {String(last.errors ?? '—')}
                </p>
                {e.slug === 'products' && (
                  <p className="mt-1 text-xs text-muted-foreground">{tb('Skipping: Arabic-only names, open/damaged/broken items, and junk names.', 'يتم تخطّي: الأسماء العربية فقط، والمنتجات المفتوحة/التالفة/المكسورة، والأسماء غير الصالحة.')}</p>
                )}
                {Array.isArray(last.skips) && last.skips.length > 0 && (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-muted-foreground">{tb('Recently skipped (sample)', 'أمثلة على ما تم تخطّيه')}</summary>
                    <ul className="mt-1 space-y-0.5 ps-4">
                      {(last.skips as { name?: string; reason?: string }[]).map((sk, j) => (
                        <li key={j} className="text-muted-foreground">
                          <span className="text-foreground">{sk.name || '—'}</span> — {tb(...(SKIP_REASON[sk.reason ?? ''] ?? [sk.reason ?? '', sk.reason ?? '']))}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </section>
            );
          })}

          <section className={card}>
            <h2 className="mb-1 text-base font-semibold text-foreground">{tb('Automatic sync', 'المزامنة التلقائية')}</h2>
            <p className="mb-3 text-sm text-muted-foreground">{tb('Runs every ~15 minutes on the worker when enabled. Plus optional WooCommerce webhooks for near-real-time.', 'تعمل كل ~15 دقيقة على العامل عند التفعيل. مع خطافات ووكومرس اختيارية للحظية.')}</p>
            <form action={saveSyncSettingsAction} className="space-y-3">
              <input type="hidden" name="locale" value={locale} />
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <input type="checkbox" name="enabled" defaultChecked={settings?.enabled} className="size-4" /> {tb('Enable scheduled sync', 'تفعيل المزامنة المجدولة')}
              </label>
              <div className="flex flex-wrap gap-4 ps-6 text-sm text-foreground">
                <label className="flex items-center gap-2"><input type="checkbox" name="p" defaultChecked={settings?.products} className="size-4" /> {tb('Products', 'المنتجات')}</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="c" defaultChecked={settings?.customers} className="size-4" /> {tb('Customers', 'العملاء')}</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="o" defaultChecked={settings?.orders} className="size-4" /> {tb('Orders', 'الطلبات')}</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="r" defaultChecked={settings?.reviews} className="size-4" /> {tb('Reviews', 'التقييمات')}</label>
              </div>
              <div>
                <span className="block text-sm font-medium text-foreground">{tb('Webhook URL (add in WooCommerce → Settings → Advanced → Webhooks)', 'رابط الخطاف (أضِفه في ووكومرس ← الإعدادات ← متقدّم ← الخطافات)')}</span>
                <input readOnly value={`${origin}/api/integration/woocommerce/webhook`} className={`${inputCls} cursor-text bg-muted font-mono text-xs`} />
              </div>
              <label className="block text-sm font-medium text-foreground">
                {tb('Webhook secret', 'سر الخطاف')}
                <input name="webhookSecret" type="password" autoComplete="off" placeholder={settings?.hasWebhookSecret ? '•••••••• ' + tb('(set — blank keeps)', '(محفوظ — فارغ يُبقي)') : tb('paste the same secret you set in WooCommerce', 'الصق نفس السر المضبوط في ووكومرس')} className={`${inputCls} font-mono text-xs`} />
              </label>
              <SubmitButton>{tb('Save automatic-sync settings', 'حفظ إعدادات المزامنة')}</SubmitButton>
            </form>
          </section>

          <p className="text-xs text-muted-foreground">{tb('Review imported drafts under', 'راجع المسودات في')} <Link href="/admin/products" className="text-primary hover:underline">{tb('Catalog → Products', 'الكتالوج ← المنتجات')}</Link>.</p>
        </div>
      )}
    </div>
  );
}
