'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { adjustAllPricesAction } from '@/server/bulk-actions';
import { inputCls } from './ui';
import { pick } from '@/lib/admin-i18n';

/**
 * Catalog-wide price adjustment ("adjust ALL products by % or ±EGP"). Guarded:
 * value required, explicit understand-checkbox, and a typed-count confirmation.
 * Selected-products price edits live in the bulk bar; this one hits everything.
 * Every change lands in the field-level change log + a `price.adjust` summary.
 */
export function PriceTools({ locale, back, total }: { locale: string; back: string; total: number }) {
  const tb = pick(useLocale());
  const [mode, setMode] = useState<'percent' | 'fixed'>('percent');
  const [value, setValue] = useState('');
  const [ack, setAck] = useState(false);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const v = Number(value);
    if (!Number.isFinite(v) || v === 0 || !ack) { e.preventDefault(); return; }
    const typed = prompt(
      tb(
        `This adjusts the price of ALL ${total} products (${mode === 'percent' ? `${v}%` : `${v > 0 ? '+' : ''}${v} EGP`}). Type ${total} to confirm.`,
        `سيعدّل هذا سعر جميع المنتجات (${total}). اكتب ${total} للتأكيد.`,
      ),
    );
    if (typed !== String(total)) e.preventDefault();
  };

  return (
    <details className="mb-4 rounded-lg border border-border bg-card">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground">
        {tb('Catalog price tools — adjust ALL prices', 'أدوات الأسعار — تعديل جميع الأسعار')}
      </summary>
      <form action={adjustAllPricesAction} onSubmit={onSubmit} className="flex flex-wrap items-end gap-3 border-t border-border p-3">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="back" value={back} />
        <label className="block text-sm font-medium">
          {tb('Adjust by', 'التعديل بـ')}
          <select name="mode" value={mode} onChange={(e) => setMode(e.target.value as 'percent' | 'fixed')} className={inputCls}>
            <option value="percent">{tb('Percentage (%)', 'نسبة مئوية (٪)')}</option>
            <option value="fixed">{tb('Fixed amount (± EGP)', 'قيمة ثابتة (± جنيه)')}</option>
          </select>
        </label>
        <label className="block w-40 text-sm font-medium">
          {mode === 'percent' ? tb('Percent (e.g. 10 or -5)', 'النسبة (مثل 10 أو -5)') : tb('EGP (e.g. 50 or -20)', 'جنيه (مثل 50 أو -20)')}
          <input name="value" type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} className={inputCls} required />
        </label>
        <label className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" name="confirmAll" checked={ack} onChange={(e) => setAck(e.target.checked)} className="size-4" />
          {tb(`I understand this changes ALL ${total} products and is recorded in the change log.`, `أفهم أن هذا يغيّر جميع المنتجات (${total}) ويُسجَّل في سجل التغييرات.`)}
        </label>
        <button disabled={!ack || !value} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {tb('Apply to ALL products', 'تطبيق على جميع المنتجات')}
        </button>
      </form>
    </details>
  );
}
