'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { publishReadyAction } from '@/server/go-live-actions';
import { pick } from '@/lib/admin-i18n';

/**
 * Go-live bulk publish (V2 GL-1). Row checkboxes in the table associate to the
 * form here via the `form` attribute (same pattern as BulkBar). Both publish
 * paths get a confirmation dialog showing the exact count about to flip.
 */
export function GoLiveBulkBar({ locale }: { locale: string }) {
  const tb = pick(useLocale());
  const formRef = useRef<HTMLFormElement>(null);
  const [count, setCount] = useState(0);
  const [allChecked, setAllChecked] = useState(false);

  const boxes = useCallback((): HTMLInputElement[] => {
    const f = formRef.current;
    if (!f) return [];
    return Array.from(f.elements).filter((e): e is HTMLInputElement => e instanceof HTMLInputElement && e.name === 'ids');
  }, []);
  const recount = useCallback(() => {
    const bs = boxes();
    const checked = bs.filter((b) => b.checked).length;
    setCount(checked);
    setAllChecked(bs.length > 0 && checked === bs.length);
  }, [boxes]);

  useEffect(() => {
    const handler = (e: Event) => {
      const t = e.target;
      if (t instanceof HTMLInputElement && t.name === 'ids') recount();
    };
    document.addEventListener('change', handler);
    return () => document.removeEventListener('change', handler);
  }, [recount]);

  const toggleAll = (checked: boolean) => {
    boxes().forEach((b) => { b.checked = checked; });
    recount();
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (count === 0) { e.preventDefault(); return; }
    if (!confirm(tb(`Publish ${count} selected product(s)? Only ready ones (price + image) will flip to Published.`, `نشر ${count} منتجًا محددًا؟ الجاهز فقط (سعر + صورة) سيتحول إلى منشور.`))) e.preventDefault();
  };

  return (
    <form id="golive-bulk" ref={formRef} action={publishReadyAction} onSubmit={onSubmit} className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-2 text-sm">
      <input type="hidden" name="locale" value={locale} />
      <label className="flex items-center gap-1.5 px-1">
        <input type="checkbox" checked={allChecked} onChange={(e) => toggleAll(e.target.checked)} className="size-4" />
        {tb('Select page', 'تحديد الصفحة')}
      </label>
      <span className="text-muted-foreground">{count} {tb('selected', 'محدد')}</span>
      <button type="submit" disabled={count === 0} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
        {tb('Publish selected', 'نشر المحدد')}
      </button>
    </form>
  );
}

/** "Publish all ready" with a count-aware confirmation (was one irreversible click). */
export function PublishAllReady({ locale, readyCount }: { locale: string; readyCount: number }) {
  const tb = pick(useLocale());
  return (
    <form
      action={publishReadyAction}
      onSubmit={(e) => {
        if (readyCount === 0) { e.preventDefault(); return; }
        if (!confirm(tb(`Publish ALL ${readyCount} ready products? They go live on the storefront immediately (out-of-stock ones stay hidden until stocked).`, `نشر جميع المنتجات الجاهزة (${readyCount})؟ ستظهر في المتجر فورًا (غير المتوفرة تبقى مخفية حتى إضافة مخزون).`))) e.preventDefault();
      }}
    >
      <input type="hidden" name="locale" value={locale} />
      <button disabled={readyCount === 0} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
        {tb(`Publish all ready (${readyCount})`, `نشر كل الجاهز (${readyCount})`)}
      </button>
    </form>
  );
}
