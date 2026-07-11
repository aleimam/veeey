import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listStocktakes, listStocktakeSchedules, counterOptions } from '@/lib/stocktake-service';
import { listLocations } from '@/lib/location-service';
import { listCategories, listBrands } from '@/lib/taxonomy-service';
import {
  createStocktakeAction, deleteStocktakeAction,
  createStocktakeScheduleAction, toggleStocktakeScheduleAction, deleteStocktakeScheduleAction,
} from '@/server/inventory-actions';
import { StatusBadge, inputCls } from '@/components/admin/ui';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { pick } from '@/lib/admin-i18n';

export const dynamic = 'force-dynamic';

export default async function StocktakePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const [sessions, schedules, locations, cats, brands, counters] = await Promise.all([
    listStocktakes(), listStocktakeSchedules(), listLocations(), listCategories(), listBrands(), counterOptions(),
  ]);

  const lbl = 'text-xs';
  const fmtDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '—');

  const scopeFields = (
    <>
      <label className={lbl}>
        {tb('Scope — category (optional)', 'النطاق — فئة (اختياري)')}
        <select name="categoryId" className={`${inputCls} w-44`}>
          <option value="">{tb('Full count', 'جرد كامل')}</option>
          {cats.filter((c) => !c.archivedAt).map((c) => <option key={c.id} value={c.id}>{c.nameEn}</option>)}
        </select>
      </label>
      <label className={lbl}>
        {tb('Scope — brand (optional)', 'النطاق — علامة (اختياري)')}
        <select name="brandId" className={`${inputCls} w-44`}>
          <option value="">{tb('Any brand', 'أي علامة')}</option>
          {brands.filter((b) => !b.archivedAt).map((b) => <option key={b.id} value={b.id}>{b.nameEn}</option>)}
        </select>
      </label>
      <label className={lbl}>
        {tb('Assigned counter (optional)', 'العدّاد المكلَّف (اختياري)')}
        <select name="assignedToId" className={`${inputCls} w-44`}>
          <option value="">{tb('— anyone —', '— أي شخص —')}</option>
          {counters.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-1.5 self-end pb-2 text-xs">
        <input type="checkbox" name="blind" className="size-4" /> {tb('Blind count (hide Expected)', 'عدّ أعمى (إخفاء المتوقع)')}
      </label>
    </>
  );

  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{tb('Stocktake', 'الجرد')}</h1>

      {/* Session setup (D20) */}
      <form action={createStocktakeAction} className="mb-8 flex flex-wrap items-end gap-2 rounded-lg border border-border p-4">
        <span className="w-full text-xs font-semibold uppercase text-muted-foreground">{tb('New session', 'جلسة جديدة')}</span>
        <input type="hidden" name="locale" value={locale} />
        <label className={lbl}>
          {tb('Session name', 'اسم الجلسة')}
          <input name="name" placeholder={tb('July 2026 — Main', 'يوليو 2026 — الرئيسي')} required className={`${inputCls} w-56`} />
        </label>
        <label className={lbl}>
          {tb('Location', 'الموقع')}
          <select name="locationId" required className={`${inputCls} w-44`}>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        {scopeFields}
        <button className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">{tb('Start session', 'بدء جلسة')}</button>
      </form>

      {/* Sessions (D20 list) */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3 text-start">{tb('Name', 'الاسم')}</th>
              <th className="p-3 text-start">{tb('Location / scope', 'الموقع / النطاق')}</th>
              <th className="p-3 text-start">{tb('Created', 'أُنشئت')}</th>
              <th className="p-3 text-center">{tb('Counted', 'معدود')}</th>
              <th className="p-3 text-center">{tb('Variances', 'الفروق')}</th>
              <th className="p-3 text-center">{tb('Adj. units', 'وحدات التسوية')}</th>
              <th className="p-3 text-start">{tb('Status', 'الحالة')}</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="p-3">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.assignedTo && <>{tb('assigned to', 'مكلَّف')} {s.assignedTo} · </>}
                    {s.blind && <span className="text-slate">{tb('blind', 'أعمى')} · </span>}
                    {s.approvedBy && <>{tb('approved by', 'اعتمده')} {s.approvedBy}</>}
                  </div>
                </td>
                <td className="p-3 text-muted-foreground">
                  {s.location.name}
                  {(s.scope.categoryId || s.scope.brandId) && <span className="block text-xs">{tb('cycle count', 'جرد دوري')}</span>}
                </td>
                <td className="p-3 text-xs text-muted-foreground">{fmtDate(s.startedAt)}<br />{s.createdBy ?? tb('system', 'النظام')}</td>
                <td className="p-3 text-center tabular-nums">{s.countedLots}</td>
                <td className={`p-3 text-center tabular-nums ${s.varianceLots > 0 ? 'font-semibold text-amber-600' : ''}`}>{s.varianceLots}</td>
                <td className="p-3 text-center tabular-nums">{s.adjustmentUnits}</td>
                <td className="p-3"><StatusBadge status={s.appliedAt ? 'APPLIED' : s.status} /></td>
                <td className="p-3 text-end">
                  <span className="inline-flex items-center gap-3">
                    <Link href={`/admin/stocktake/${s.id}`} className="text-primary hover:underline">{tb('Open', 'فتح')}</Link>
                    {!s.appliedAt && (
                      <form action={deleteStocktakeAction} className="inline">
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="sessionId" value={s.id} />
                        <ConfirmButton warn={tb(`Delete session "${s.name}" and its recorded counts?`, `حذف الجلسة "${s.name}" وعدّها المسجل؟`)} className="text-xs text-destructive hover:underline">
                          {tb('Delete', 'حذف')}
                        </ConfirmButton>
                      </form>
                    )}
                  </span>
                </td>
              </tr>
            ))}
            {sessions.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">{tb('No sessions yet — start one above.', 'لا توجد جلسات بعد — ابدأ واحدة بالأعلى.')}</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Cycle-count schedules (D21) */}
      <section className="mt-10">
        <h2 className="mb-1 text-sm font-semibold">{tb('Recurring cycle counts', 'الجرد الدوري المتكرر')}</h2>
        <p className="mb-3 max-w-3xl text-xs text-muted-foreground">
          {tb('A session opens automatically from each schedule when due (checked daily). Scope it to a category or brand for quick partial counts.', 'تُفتح جلسة تلقائيًا من كل جدولة عند استحقاقها (يُفحص يوميًا). حدّد النطاق بفئة أو علامة لجرد جزئي سريع.')}
        </p>

        <form action={createStocktakeScheduleAction} className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-border p-4">
          <input type="hidden" name="locale" value={locale} />
          <label className={lbl}>
            {tb('Schedule name', 'اسم الجدولة')}
            <input name="name" placeholder={tb('Vitamins aisle', 'ممر الفيتامينات')} required className={`${inputCls} w-48`} />
          </label>
          <label className={lbl}>
            {tb('Location', 'الموقع')}
            <select name="locationId" required className={`${inputCls} w-40`}>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>
          <label className={lbl}>
            {tb('Every (days)', 'كل (أيام)')}
            <input name="intervalDays" type="number" min={1} defaultValue={30} required className={`${inputCls} w-24`} />
          </label>
          {scopeFields}
          <button className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">{tb('Add schedule', 'إضافة جدولة')}</button>
        </form>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-start">{tb('Schedule', 'الجدولة')}</th>
                <th className="p-3 text-start">{tb('Location', 'الموقع')}</th>
                <th className="p-3 text-center">{tb('Every', 'كل')}</th>
                <th className="p-3 text-start">{tb('Next run', 'التشغيل القادم')}</th>
                <th className="p-3 text-start">{tb('Last run', 'آخر تشغيل')}</th>
                <th className="p-3 text-start">{tb('Status', 'الحالة')}</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id} className={`border-t border-border ${!s.active ? 'opacity-60' : ''}`}>
                  <td className="p-3 font-medium">{s.name}{s.blind && <span className="ms-1.5 text-xs font-normal text-slate">({tb('blind', 'أعمى')})</span>}</td>
                  <td className="p-3 text-muted-foreground">{s.location.name}</td>
                  <td className="p-3 text-center">{s.intervalDays} {tb('days', 'يوم')}</td>
                  <td className="p-3 text-xs text-muted-foreground">{fmtDate(s.nextAt)}</td>
                  <td className="p-3 text-xs text-muted-foreground">{fmtDate(s.lastRunAt)}</td>
                  <td className="p-3">
                    <form action={toggleStocktakeScheduleAction}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="active" value={s.active ? '0' : '1'} />
                      <button className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        {s.active ? tb('Active — pause', 'نشطة — إيقاف') : tb('Paused — activate', 'موقوفة — تفعيل')}
                      </button>
                    </form>
                  </td>
                  <td className="p-3 text-end">
                    <form action={deleteStocktakeScheduleAction} className="inline">
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="id" value={s.id} />
                      <ConfirmButton warn={tb(`Delete the schedule "${s.name}"?`, `حذف الجدولة "${s.name}"؟`)} className="text-xs text-destructive hover:underline">
                        {tb('Delete', 'حذف')}
                      </ConfirmButton>
                    </form>
                  </td>
                </tr>
              ))}
              {schedules.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">{tb('No schedules yet.', 'لا توجد جدولات بعد.')}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
