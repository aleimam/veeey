'use client';

import { useActionState } from 'react';
import { useLocale } from 'next-intl';
import { importCsvAction, type ImportState } from '@/server/import-actions';
import { pick } from '@/lib/admin-i18n';
import { inputCls } from './ui';

/** CSV import widget (FR-ADM): upload → create-only/skip-existing → result report. */
export function ImportForm({ entity }: { entity: string }) {
  const t = pick(useLocale());
  const [state, action, pending] = useActionState<ImportState, FormData>(importCsvAction, {});
  const r = state.report;

  const errMsg = state.error
    ? t(
        state.error === 'no_file' ? 'Choose a CSV file.' : state.error === 'too_large' ? 'File too large (max 5 MB).' : state.error === 'empty' ? 'The file has no rows.' : 'Could not import.',
        state.error === 'no_file' ? 'اختر ملف CSV.' : state.error === 'too_large' ? 'الملف كبير جدًا (الحد 5 ميجابايت).' : state.error === 'empty' ? 'لا توجد صفوف في الملف.' : 'تعذّر الاستيراد.',
      )
    : null;

  return (
    <div className="max-w-2xl">
      <form action={action} className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4">
        <input type="hidden" name="entity" value={entity} />
        <label className="text-sm font-medium">{t('CSV file', 'ملف CSV')}
          <input name="file" type="file" accept=".csv,text/csv" required className={`${inputCls} block`} />
        </label>
        <button disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
          {pending ? t('Importing…', 'جارٍ الاستيراد…') : t('Import', 'استيراد')}
        </button>
      </form>

      {errMsg && <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{errMsg}</p>}

      {r && (
        <div className="mt-4 rounded-lg border border-border p-4 text-sm">
          <p className="font-medium">
            {t('Created', 'تم إنشاء')}: {r.created} · {t('Skipped (already exist)', 'تم تخطّيها (موجودة)')}: {r.skipped} · {t('Invalid', 'غير صالحة')}: {r.invalid.length}
          </p>
          {r.invalid.length > 0 && (
            <div className="mt-3 max-h-72 overflow-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <thead className="bg-surface text-muted-foreground"><tr><th className="p-2 text-start">{t('Row', 'الصف')}</th><th className="p-2 text-start">{t('Reason', 'السبب')}</th></tr></thead>
                <tbody>
                  {r.invalid.map((x, i) => <tr key={i} className="border-t border-border"><td className="p-2">{x.row}</td><td className="p-2">{x.reason}</td></tr>)}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
