import { setRequestLocale } from 'next-intl/server';
import { requirePermission } from '@/lib/auth-guards';
import { pick } from '@/lib/admin-i18n';
import { getSetting } from '@/lib/settings-service';
import { listErrorLogs, errorLogCounts } from '@/lib/error-log';
import { toggleErrorLogAction, clearErrorLogAction } from '@/server/error-actions';
import { ConfirmButton } from '@/components/admin/confirm-button';

export const dynamic = 'force-dynamic';
type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ErrorLogPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  await requirePermission('settings.manage');
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const level = one(sp.level);

  const [enabledRaw, rows, counts] = await Promise.all([
    getSetting('errorLog.enabled').catch(() => 'true'),
    listErrorLogs(200, level),
    errorLogCounts().catch(() => []),
  ]);
  const enabled = enabledRaw !== 'false';
  const countOf = (l: string) => counts.find((c) => c.level === l)?._count ?? 0;
  const badge = (l: string) => l === 'NOT_FOUND' ? 'bg-gold/20 text-slate' : l === 'WARN' ? 'bg-orange-500/15 text-orange-700 dark:text-orange-400' : 'bg-destructive/10 text-destructive';

  return (
    <div className="p-6">
      <h1 className="mb-1 font-heading text-xl font-semibold">{tb('Error log', 'سجل الأخطاء')}</h1>
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">{tb('404s and runtime/server errors captured by the system. Logging is optional — toggle it below.', 'أخطاء 404 وأخطاء التشغيل/الخادم التي يلتقطها النظام. التسجيل اختياري — بدّله بالأسفل.')}</p>

      {one(sp.saved) != null && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Saved ✓', 'تم الحفظ ✓')}</p>}
      {one(sp.cleared) != null && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb(`Cleared ${one(sp.cleared)} entries.`, `تم مسح ${one(sp.cleared)} إدخالًا.`)}</p>}

      <div className="mb-5 flex flex-wrap items-center gap-4 rounded-lg border border-border p-4">
        <form action={toggleErrorLogAction} className="flex items-center gap-2">
          <input type="hidden" name="locale" value={locale} />
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="enabled" defaultChecked={enabled} className="size-4" /> {tb('Enable error logging', 'تفعيل تسجيل الأخطاء')}
          </label>
          <button className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">{tb('Save', 'حفظ')}</button>
        </form>
        <span className="text-sm text-muted-foreground">
          {tb('Errors:', 'أخطاء:')} {countOf('ERROR')} · {tb('Warnings:', 'تحذيرات:')} {countOf('WARN')} · 404: {countOf('NOT_FOUND')}
        </span>
        <form action={clearErrorLogAction} className="ms-auto">
          <input type="hidden" name="locale" value={locale} />
          <ConfirmButton warn={tb('Clear the entire error log?', 'مسح سجل الأخطاء بالكامل؟')} className="rounded-md border border-border px-3 py-1.5 text-sm text-destructive hover:bg-surface">{tb('Clear log', 'مسح السجل')}</ConfirmButton>
        </form>
      </div>

      <div className="mb-3 flex gap-2 text-sm">
        {[['', tb('All', 'الكل')], ['ERROR', tb('Errors', 'أخطاء')], ['WARN', tb('Warnings', 'تحذيرات')], ['NOT_FOUND', '404']].map(([v, l]) => (
          <a key={v} href={`?${v ? `level=${v}` : ''}`} className={`rounded-md border px-3 py-1 ${level === v || (!level && !v) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-surface'}`}>{l}</a>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr><th className="p-3 text-start">{tb('When', 'الوقت')}</th><th className="p-3 text-start">{tb('Level', 'المستوى')}</th><th className="p-3 text-start">{tb('Message', 'الرسالة')}</th><th className="p-3 text-start">{tb('Source', 'المصدر')}</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border align-top">
                <td className="whitespace-nowrap p-3 text-muted-foreground">{new Date(r.createdAt).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-GB')}</td>
                <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge(r.level)}`}>{r.level}</span></td>
                <td className="max-w-lg p-3"><span className="line-clamp-3 break-words" dir="ltr">{r.message}</span></td>
                <td className="max-w-[220px] p-3 text-muted-foreground"><span className="line-clamp-2 break-all" dir="ltr">{r.source ?? '—'}</span></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">{tb('No errors logged.', 'لا توجد أخطاء مسجّلة.')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
