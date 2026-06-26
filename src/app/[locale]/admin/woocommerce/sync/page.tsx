import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth-guards';
import { hasPermission } from '@/lib/rbac';
import { pick } from '@/lib/admin-i18n';
import { wooConfigured } from '@/lib/woocommerce';
import { getSyncState } from '@/lib/migration/wc-sync';
import { SubmitButton } from '@/components/admin/ui';
import { Link } from '@/i18n/navigation';
import { syncProductsAction } from '@/server/woocommerce-sync-actions';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const lastResult = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});

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
  const state = configured ? await getSyncState('products') : null;
  const last = lastResult(state?.lastResult);

  const card = 'rounded-xl border border-border bg-card p-5';
  const ran = one(sp.ran);

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-2 font-heading text-xl font-semibold text-foreground">{tb('Live sync', 'المزامنة الحية')}</h1>
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        {tb(
          'Pull changes from Egypt Vitamins into Veeey. Conflict policy: a record syncs until you edit it in Veeey, then it detaches and sync leaves it alone. New products arrive as draft/PRIVATE for review.',
          'اسحب التغييرات من إيجيبت فيتامينز إلى Veeey. سياسة التعارض: يُزامَن السجل حتى تعدّله في Veeey ثم ينفصل ولا تلمسه المزامنة. المنتجات الجديدة تصل كمسودة/خاصة للمراجعة.',
        )}
      </p>
      <div className="mb-5 max-w-2xl rounded-lg border border-gold/40 bg-gold/10 p-3 text-xs text-foreground">
        {tb(
          '⚠ This writes to Veeey’s database. Start with a small page count and review the imported drafts before running a full sync. Phase 1 covers products; customers & orders are next.',
          '⚠ هذا يكتب في قاعدة بيانات Veeey. ابدأ بعدد صفحات صغير وراجع المسودات قبل المزامنة الكاملة. المرحلة 1 للمنتجات؛ العملاء والطلبات لاحقًا.',
        )}
      </div>

      {one(sp.error) && <div className="mb-5 max-w-2xl rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Sync failed.', 'فشلت المزامنة.')}</div>}
      {ran === 'products' && (
        <div className="mb-5 max-w-2xl rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
          {tb(
            `Synced products — scanned ${one(sp.scanned) ?? 0}, created ${one(sp.created) ?? 0}, updated ${one(sp.updated) ?? 0}, kept (detached) ${one(sp.detached) ?? 0}, errors ${one(sp.errors) ?? 0}.`,
            `تمت مزامنة المنتجات — مفحوص ${one(sp.scanned) ?? 0}، مُنشأ ${one(sp.created) ?? 0}، محدَّث ${one(sp.updated) ?? 0}، مُبقى (منفصل) ${one(sp.detached) ?? 0}، أخطاء ${one(sp.errors) ?? 0}.`,
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
          <section className={card}>
            <h2 className="mb-1 text-base font-semibold text-foreground">{tb('Products', 'المنتجات')}</h2>
            <p className="mb-4 text-sm text-muted-foreground">{tb('Incremental — only pulls products changed since the last run.', 'تزايدي — يسحب فقط المنتجات التي تغيّرت منذ آخر تشغيل.')}</p>
            <form action={syncProductsAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="locale" value={locale} />
              <label className="text-sm text-foreground">
                {tb('Pages this run', 'الصفحات لكل تشغيل')}
                <select name="pages" defaultValue="5" className="mt-1 block rounded-md border border-border bg-card px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring">
                  {[1, 5, 10, 20, 50].map((n) => <option key={n} value={n}>{n} ({n * 50} {tb('products', 'منتج')})</option>)}
                </select>
              </label>
              <SubmitButton>{tb('Sync now', 'زامن الآن')}</SubmitButton>
            </form>
          </section>

          <section className={card}>
            <h2 className="mb-3 text-base font-semibold text-foreground">{tb('Status', 'الحالة')}</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-muted-foreground">{tb('Last run', 'آخر تشغيل')}</dt><dd className="font-medium text-foreground">{state?.lastRunAt ? new Date(state.lastRunAt).toISOString().replace('T', ' ').slice(0, 16) : '—'}</dd></div>
              <div><dt className="text-muted-foreground">{tb('Cursor (modified after)', 'المؤشّر')}</dt><dd className="font-mono text-xs text-foreground">{state?.cursor ?? '—'}</dd></div>
              <div><dt className="text-muted-foreground">{tb('Last created / updated', 'آخر إنشاء / تحديث')}</dt><dd className="font-medium text-foreground">{String(last.created ?? '—')} / {String(last.updated ?? '—')}</dd></div>
              <div><dt className="text-muted-foreground">{tb('Last detached / errors', 'آخر منفصل / أخطاء')}</dt><dd className="font-medium text-foreground">{String(last.detached ?? '—')} / {String(last.errors ?? '—')}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">{tb('Review imported drafts under', 'راجع المسودات المستوردة في')} <Link href="/admin/products" className="text-primary hover:underline">{tb('Catalog → Products', 'الكتالوج ← المنتجات')}</Link> ({tb('filter by status: Private', 'رشّح بالحالة: خاص')}).</p>
          </section>
        </div>
      )}
    </div>
  );
}
