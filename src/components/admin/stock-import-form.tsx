'use client';

import { useActionState } from 'react';
import { importStockAction, type StockImportState } from '@/server/go-live-actions';
import { SubmitButton, inputCls } from './ui';
import { pick } from '@/lib/admin-i18n';

export function StockImportForm({ locale }: { locale: string }) {
  const tb = pick(locale);
  const [state, action] = useActionState<StockImportState, FormData>(importStockAction, {});
  const err = state.error;

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <p className="text-xs text-muted-foreground">
        {tb('CSV columns: sku (required — Veeey SKU, Egypt Vitamins SKU, or EV product ID), qty (required), expiry (blank/NA = non-perishable; accepts 2028-12-31 or 31-12-2028), price (optional EGP per-lot), location (optional — id or name, created if new), batch, sale (optional). Each row adds a LIVE lot.', 'أعمدة CSV: sku (مطلوب — SKU في Veeey أو SKU إيجيبت فيتامينز أو معرّف EV)، qty (مطلوب)، expiry (فارغ/NA = بدون صلاحية؛ يقبل 2028-12-31 أو 31-12-2028)، price (اختياري بالجنيه لكل دفعة)، location (اختياري — معرّف أو اسم، يُنشأ إن كان جديدًا)، batch، sale (اختياري). كل صف يضيف دفعة حية.')}
      </p>
      <input name="file" type="file" accept=".csv,text/csv" required className={`${inputCls} block`} />
      <SubmitButton>{tb('Import stock', 'استيراد المخزون')}</SubmitButton>

      {err && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{
        err === 'no_file' ? tb('Choose a CSV file.', 'اختر ملف CSV.')
          : err === 'too_large' ? tb('File too large (max 5MB).', 'الملف كبير جدًا (الحد 5 ميجابايت).')
            : err === 'empty' ? tb('No rows found.', 'لا توجد صفوف.')
              : tb('Import failed.', 'فشل الاستيراد.')
      }</p>}

      {state.report && (
        <div className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
          {tb(`Added stock to ${state.report.created} product(s).`, `تمت إضافة مخزون لـ ${state.report.created} منتج.`)}
          {state.report.invalid.length > 0 && (
            <details className="mt-1 text-destructive">
              <summary className="cursor-pointer">{tb(`${state.report.invalid.length} row(s) skipped`, `تم تخطّي ${state.report.invalid.length} صف`)}</summary>
              <ul className="mt-1 list-inside list-disc text-xs">
                {state.report.invalid.slice(0, 50).map((i, idx) => <li key={idx}>{tb('Row', 'صف')} {i.row}: {i.reason}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}
    </form>
  );
}
