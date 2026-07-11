import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getStocktake, sheetRows, reconcileRows } from '@/lib/stocktake-service';
import { applyStocktakeAction, closeStocktakeAction } from '@/server/inventory-actions';
import { StatusBadge } from '@/components/admin/ui';
import { StocktakeSheet } from '@/components/admin/stocktake-sheet';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { conditionLabel, isConditionVariant } from '@/lib/lot-condition';
import { pick } from '@/lib/admin-i18n';

export const dynamic = 'force-dynamic';
type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function StocktakeDetailPage({ params, searchParams }: { params: Promise<{ locale: string; id: string }> ; searchParams: Promise<SP> }) {
  const { locale, id } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const session = await getStocktake(id);
  if (!session) notFound();
  const [rows, reconcile] = await Promise.all([sheetRows(id), reconcileRows(id)]);
  const open = session.status === 'OPEN';
  const variances = reconcile.filter((r) => r.variance !== 0);
  const justApplied = one(sp.applied) === '1';

  const snap = (session.snapshotJson ?? {}) as { countedLots?: number; adjustedLots?: number; adjustedUnits?: number; discarded?: boolean };
  const fmtTime = (d: Date | null) => (d ? d.toISOString().slice(0, 16).replace('T', ' ') : '—');

  return (
    <div className="p-6">
      <Link href="/admin/stocktake" className="text-sm text-primary hover:underline">← {tb('Stocktake', 'الجرد')}</Link>
      <header className="mb-6 mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold">{session.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {session.location.name} · <StatusBadge status={session.appliedAt ? 'APPLIED' : session.status} />
            {session.blind && <span className="rounded-full bg-slate/10 px-2 py-0.5 text-xs font-medium text-slate">{tb('Blind count', 'عدّ أعمى')}</span>}
          </p>
        </div>
      </header>

      {justApplied && (
        <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
          {tb(`Adjustments applied ✓ — ${snap.adjustedLots ?? 0} lot(s), ${snap.adjustedUnits ?? 0} unit(s).`, `تم تطبيق التسويات ✓ — ${snap.adjustedLots ?? 0} تشغيلة، ${snap.adjustedUnits ?? 0} وحدة.`)}
        </p>
      )}
      {!open && !session.appliedAt && snap.discarded && (
        <p className="mb-4 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{tb('This session was closed WITHOUT applying — counts kept for reference, stock unchanged.', 'أُغلقت هذه الجلسة دون تطبيق — احتُفظ بالعدّ للمرجعية، والمخزون لم يتغير.')}</p>
      )}

      <h2 className="mb-3 text-sm font-semibold">
        {tb('Count sheet', 'ورقة العدّ')} ({rows.length} {tb('lots in scope', 'تشغيلة في النطاق')})
        {session.blind && open && <span className="ms-2 text-xs font-normal text-muted-foreground">{tb('Expected quantities are hidden until reconcile.', 'الكميات المتوقعة مخفية حتى المطابقة.')}</span>}
      </h2>
      <StocktakeSheet sessionId={session.id} rows={rows} blind={session.blind && open} readOnly={!open} />
      <p className="mt-3 text-xs text-muted-foreground">
        {tb(
          'Expected = available stock + active reservations. Saving RECORDS counts only — stock changes when a reviewer approves the reconcile step below. Uncounted lots are never touched.',
          'المتوقع = المخزون المتاح + الحجوزات النشطة. الحفظ يسجّل العدّ فقط — يتغير المخزون عند اعتماد خطوة المطابقة أدناه. التشغيلات غير المعدودة لا تُمسّ أبدًا.',
        )}
      </p>

      {/* Reconcile & apply (D18) */}
      <section className="mt-10">
        <h2 className="mb-1 text-sm font-semibold">{tb('Reconcile', 'المطابقة')} — {variances.length} {tb('variance(s)', 'فرق')}</h2>
        <p className="mb-3 max-w-3xl text-xs text-muted-foreground">
          {tb('Review every discrepancy, then approve to adjust stock at the lot level (writes the movement ledger + audit trail), or close without applying to discard.', 'راجع كل فرق ثم اعتمد لتسوية المخزون على مستوى التشغيلة (يُكتب في سجل الحركات وسجل التدقيق)، أو أغلق دون تطبيق للتجاهل.')}
        </p>
        <div className="mb-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-start">{tb('Product', 'المنتج')}</th>
                <th className="p-3 text-start">{tb('Expiry', 'الصلاحية')}</th>
                <th className="p-3 text-center">{tb('Live qty', 'الكمية الحالية')}</th>
                <th className="p-3 text-center">{tb('Counted', 'المعدود')}</th>
                <th className="p-3 text-center">{tb('Adjustment', 'التسوية')}</th>
                <th className="p-3 text-start">{tb('Reason', 'السبب')}</th>
                <th className="p-3 text-start">{tb('Counted by', 'عدّه')}</th>
              </tr>
            </thead>
            <tbody>
              {variances.map((r) => (
                <tr key={r.countId} className="border-t border-border">
                  <td className="p-3">
                    <span className="font-medium">{r.name}</span> <span className="font-mono text-xs text-muted-foreground">{r.sku}</span>
                    {r.condition && isConditionVariant(r.condition) && <span className="ms-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">{conditionLabel(r.condition, locale)}</span>}
                  </td>
                  <td className="p-3 text-muted-foreground">{r.expiry ?? '—'}</td>
                  <td className="p-3 text-center tabular-nums">{r.currentQty ?? '—'}</td>
                  <td className="p-3 text-center tabular-nums">{r.counted}</td>
                  <td className={`p-3 text-center font-semibold tabular-nums ${r.variance > 0 ? 'text-primary' : 'text-destructive'}`}>{r.variance > 0 ? '+' : ''}{r.variance}</td>
                  <td className="p-3 text-xs text-muted-foreground">{r.reason ?? '—'}</td>
                  <td className="p-3 text-xs text-muted-foreground">{r.countedBy ?? '—'}<br />{fmtTime(r.countedAt)}</td>
                </tr>
              ))}
              {variances.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">{tb('No variances — every counted lot matches.', 'لا فروق — كل تشغيلة معدودة مطابقة.')}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {open && (
          <div className="flex flex-wrap items-center gap-3">
            <form action={applyStocktakeAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="sessionId" value={session.id} />
              <ConfirmButton
                warn={tb(
                  `Approve & apply? ${variances.length} lot adjustment(s) will change live stock and be written to the movement ledger. This closes the session.`,
                  `اعتماد وتطبيق؟ ستُغيّر ${variances.length} تسوية المخزون الفعلي وتُكتب في سجل الحركات. سيؤدي هذا لإغلاق الجلسة.`,
                )}
                className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                {tb('Approve & apply adjustments', 'اعتماد وتطبيق التسويات')}
              </ConfirmButton>
            </form>
            <form action={closeStocktakeAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="sessionId" value={session.id} />
              <ConfirmButton
                warn={tb('Close WITHOUT applying? Recorded counts are kept for reference but stock will NOT change.', 'إغلاق دون تطبيق؟ سيُحتفظ بالعدّ للمرجعية لكن المخزون لن يتغيّر.')}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface"
              >
                {tb('Close & discard', 'إغلاق وتجاهل')}
              </ConfirmButton>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}
