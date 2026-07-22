import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listSpamSuspects } from '@/lib/customer-admin-service';
import { STRONG_REASONS, type SpamReason } from '@/lib/customer-spam';
import { SpamPurgeForm, SelectAllSpam } from '@/components/admin/spam-purge-form';
import { pick } from '@/lib/admin-i18n';
import type { SP } from '@/lib/admin-list';

export const dynamic = 'force-dynamic';

const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v) || undefined;

const REASON_LABEL: Record<SpamReason, [string, string]> = {
  'disposable-email': ['Throwaway inbox', 'بريد مؤقت'],
  'spam-email-domain': ['Junk-farm email domain', 'نطاق بريد مشبوه'],
  'link-in-name': ['Link in the name', 'رابط داخل الاسم'],
  'cyrillic-name': ['Cyrillic name', 'اسم بحروف سيريلية'],
  'no-name-no-orders': ['No name, never ordered', 'بلا اسم ولم يشترِ'],
  'stale-unverified': ['Unverified for 90+ days', 'غير مؤكد منذ ٩٠+ يومًا'],
  'signup-burst': ['Part of a signup burst', 'ضمن موجة تسجيل'],
};

export default async function SpamReviewPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);

  const { scanned, suspects } = await listSpamSuspects();
  const deletable = suspects.filter((s) => s.purgeable);
  const review = suspects.filter((s) => !s.purgeable);
  const fmtDate = (d: Date) => d.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const deleted = one(sp.deleted);
  const skipped = Number(one(sp.skipped) ?? 0);

  return (
    <div className="p-6">
      <header className="mb-6">
        <p className="text-sm text-muted-foreground">
          <Link href="/admin/customers" className="hover:underline">{tb('Customers', 'العملاء')}</Link>
          {' › '}{tb('Suspected fake accounts', 'حسابات مشتبه بأنها وهمية')}
        </p>
        <h1 className="mt-1 font-heading text-xl font-semibold">{tb('Suspected fake accounts', 'حسابات مشتبه بأنها وهمية')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {tb(
            `${scanned} accounts checked · ${deletable.length} safe to delete · ${review.length} need a human look.`,
            `تم فحص ${scanned} حساب · ${deletable.length} يمكن حذفها بأمان · ${review.length} تحتاج مراجعة.`,
          )}
        </p>
      </header>

      {deleted != null && (
        <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
          {tb(`Deleted ${deleted} account(s).`, `تم حذف ${deleted} حساب.`)}
          {skipped > 0 ? tb(` ${skipped} kept — they no longer qualify (an order or a verified contact appeared).`, ` تم الإبقاء على ${skipped} — لم تعد مؤهلة (ظهر طلب أو وسيلة اتصال مؤكدة).`) : ''}
        </p>
      )}
      {one(sp.error) === 'delete' && (
        <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Deletion failed.', 'فشل الحذف.')}</p>
      )}

      <section className="mb-8">
        <h2 className="mb-1 font-heading text-base font-semibold">{tb('Safe to delete', 'يمكن حذفها بأمان')} ({deletable.length})</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          {tb(
            'Each of these matched a strong signal, has never placed an order and has no verified email or phone — there is nothing to lose by removing them. Untick anything you recognise.',
            'كل حساب هنا طابق إشارة قوية، ولم يطلب أبدًا، وليس لديه بريد أو هاتف مؤكد — لا يوجد ما يُفقد بحذفه. أزل التحديد عن أي حساب تعرفه.',
          )}
        </p>

        {deletable.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface px-4 py-6 text-center text-sm text-muted-foreground">
            {tb('Nothing to delete — no account matched a strong signal.', 'لا يوجد ما يُحذف — لم يطابق أي حساب إشارة قوية.')}
          </p>
        ) : (
          <SpamPurgeForm locale={locale}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <SelectAllSpam label={tb('Select all', 'تحديد الكل')} />
              <button className="rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground">
                {tb('Delete selected', 'حذف المحدد')}
              </button>
            </div>
            <SuspectTable rows={deletable} locale={locale} selectable fmtDate={fmtDate} />
          </SpamPurgeForm>
        )}
      </section>

      <section>
        <h2 className="mb-1 font-heading text-base font-semibold">{tb('Flagged for review', 'مُعلَّمة للمراجعة')} ({review.length})</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          {tb(
            'Weaker signals only — quiet, unverified or bulk-imported accounts look the same as bots here, so these are never deleted automatically. Open one to block or delete it yourself.',
            'إشارات أضعف فقط — الحسابات الهادئة أو غير المؤكدة أو المستوردة تشبه الروبوتات هنا، لذا لا تُحذف تلقائيًا أبدًا. افتح أي حساب لحظره أو حذفه بنفسك.',
          )}
        </p>
        {review.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface px-4 py-6 text-center text-sm text-muted-foreground">
            {tb('Nothing flagged.', 'لا يوجد شيء معلَّم.')}
          </p>
        ) : (
          <SuspectTable rows={review} locale={locale} fmtDate={fmtDate} />
        )}
      </section>
    </div>
  );
}

type Row = Awaited<ReturnType<typeof listSpamSuspects>>['suspects'][number];

function SuspectTable({ rows, locale, selectable, fmtDate }: { rows: Row[]; locale: string; selectable?: boolean; fmtDate: (d: Date) => string }) {
  const tb = pick(locale);
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface text-xs uppercase text-muted-foreground">
          <tr>
            {selectable && <th className="w-8 p-3" />}
            <th className="p-3 text-start">{tb('Name', 'الاسم')}</th>
            <th className="p-3 text-start">{tb('Email', 'البريد الإلكتروني')}</th>
            <th className="p-3 text-start">{tb('Phone', 'الهاتف')}</th>
            <th className="p-3 text-start">{tb('Joined', 'انضم')}</th>
            <th className="p-3 text-start">{tb('Why', 'السبب')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border align-top">
              {selectable && (
                <td className="p-3">
                  <input type="checkbox" name="ids" value={r.id} defaultChecked className="size-4" aria-label={r.email || r.name || r.id} />
                </td>
              )}
              <td className="p-3">
                <Link href={`/admin/customers/${r.id}`} className="font-medium hover:underline">
                  {r.name || r.email || tb('(no name)', '(بلا اسم)')}
                </Link>
              </td>
              <td className="p-3 break-all text-muted-foreground">{r.email ?? '—'}</td>
              <td className="p-3 text-muted-foreground">{r.phone ?? '—'}</td>
              <td className="p-3 whitespace-nowrap text-muted-foreground">{fmtDate(r.createdAt)}</td>
              <td className="p-3">
                <div className="flex flex-wrap gap-1">
                  {r.reasons.map((reason) => (
                    <span
                      key={reason}
                      className={`rounded-full px-2 py-0.5 text-xs ${STRONG_REASONS.includes(reason) ? 'bg-destructive/10 text-destructive' : 'bg-surface text-muted-foreground'}`}
                    >
                      {pick(locale)(REASON_LABEL[reason][0], REASON_LABEL[reason][1])}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
