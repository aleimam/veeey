import { setRequestLocale } from 'next-intl/server';
import { listTiers } from '@/lib/tier-service';
import { AdminList } from '@/components/admin/resource-list';
import { InUseNotice } from '@/components/admin/row-actions';
import { deleteTierAction } from '@/server/tier-actions';
import { backfillAllPointsAction } from '@/server/loyalty-actions';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { getCurrentUser } from '@/lib/auth-guards';
import { hasPermission } from '@/lib/rbac';
import { pick } from '@/lib/admin-i18n';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function TiersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const [tiers, user] = await Promise.all([listTiers(), getCurrentUser()]);
  const canManagePoints = hasPermission(user?.permissions ?? [], 'pricing.manage');

  return (
    <AdminList
      title={tb('Loyalty tiers', 'فئات الولاء')}
      newHref="/admin/tiers/edit"
      newLabel={tb('New tier', 'فئة جديدة')}
      head={[tb('Rank', 'الرتبة'), tb('Name', 'الاسم'), tb('Arabic', 'العربية'), tb('Key', 'الكود'), tb('Points / EGP', 'نقاط / ج.م'), tb('Color', 'اللون'), tb('Members', 'الأعضاء'), tb('Rules', 'القواعد')]}
      editLabel={tb('Edit & rules', 'تعديل والقواعد')}
      notice={<>
        <InUseNotice show={one(sp.error) === 'in_use'} />
        {one(sp.backfill) === 'started' && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Retroactive points backfill started in the background for all customers.', 'بدأ منح النقاط بأثر رجعي في الخلفية لجميع العملاء.')}</p>}
        {canManagePoints && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface/50 p-3">
            <span className="text-sm text-muted-foreground">{tb('Give loyalty points for every customer’s past delivered orders that never earned any (points only; lifetime spend is unchanged). Safe to run again — already-credited orders are skipped.', 'منح نقاط الولاء عن كل الطلبات المُسلَّمة السابقة التي لم تكسب نقاطًا (النقاط فقط؛ لا يتغيّر إجمالي الإنفاق). آمن للتكرار — تُتجاهل الطلبات المُحتسبة.')}</span>
            <form action={backfillAllPointsAction}>
              <input type="hidden" name="locale" value={locale} />
              <ConfirmButton warn={tb('Backfill retroactive points for ALL customers’ past orders? Runs in the background.', 'منح نقاط بأثر رجعي عن الطلبات السابقة لجميع العملاء؟ يعمل في الخلفية.')} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                {tb('Backfill all past orders', 'منح نقاط كل الطلبات السابقة')}
              </ConfirmButton>
            </form>
          </div>
        )}
      </>}
      rows={tiers.map((t) => ({
        key: t.id,
        cells: [
          String(t.rank),
          t.nameEn,
          t.nameAr,
          t.key,
          String(t.earnRatePerEgp),
          <span key="c" className="inline-flex items-center gap-2">
            <span className="inline-block size-4 rounded-full border border-border" style={{ backgroundColor: t.color ?? 'transparent' }} />
            {t.color ?? '—'}
          </span>,
          String(t._count.customers),
          String(t._count.rules),
        ],
        editHref: `/admin/tiers/edit/${t.id}`,
        actions: (
          <form action={deleteTierAction}>
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="locale" value={locale} />
            <button className="text-destructive hover:underline">{tb('Delete', 'حذف')}</button>
          </form>
        ),
      }))}
    />
  );
}
