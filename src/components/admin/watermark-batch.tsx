'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { pick } from '@/lib/admin-i18n';
import { inputCls } from '@/components/admin/ui';
import { runWatermarkAction } from '@/server/watermark-actions';

type Opt = { id: string; name: string };

/** Batch stamp / re-stamp / remove over a chosen group of products. */
export function WatermarkBatch({ locale, categories, brands, collections }: { locale: string; categories: Opt[]; brands: Opt[]; collections: Opt[] }) {
  const tb = pick(useLocale());
  const [scope, setScope] = useState<'all' | 'category' | 'brand' | 'collection'>('all');
  const opts = scope === 'category' ? categories : scope === 'brand' ? brands : scope === 'collection' ? collections : [];

  return (
    <form action={runWatermarkAction} className="space-y-4 rounded-lg border border-border p-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="action" id="wm-action" value="stamp" />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">{tb('Apply to', 'التطبيق على')}
          <select name="scope" value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} className={inputCls}>
            <option value="all">{tb('All products', 'كل المنتجات')}</option>
            <option value="category">{tb('A category', 'فئة')}</option>
            <option value="brand">{tb('A brand', 'علامة تجارية')}</option>
            <option value="collection">{tb('A collection', 'مجموعة')}</option>
          </select>
        </label>
        {scope !== 'all' && (
          <label className="text-sm font-medium">{tb('Choose', 'اختر')}
            <select name="scopeId" className={inputCls} required>
              <option value="">{tb('— select —', '— اختر —')}</option>
              {opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="primaryOnly" className="size-4" /> {tb('Primary photo only (not every gallery image)', 'الصورة الرئيسية فقط (وليس كل الصور)')}</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="onlyUnstamped" defaultChecked className="size-4" /> {tb('Skip already-stamped (for Stamp)', 'تجاهل المختومة مسبقًا (للختم)')}</label>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="submit" onClick={() => { (document.getElementById('wm-action') as HTMLInputElement).value = 'stamp'; }}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
          {tb('Stamp / re-stamp', 'ختم / إعادة ختم')}
        </button>
        <button type="submit" onClick={() => { (document.getElementById('wm-action') as HTMLInputElement).value = 'remove'; }}
          className="rounded-md border border-border px-4 py-2 text-sm text-destructive hover:bg-surface">
          {tb('Remove watermark (restore originals)', 'إزالة العلامة (استعادة الأصل)')}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">{tb('Runs in the background. Originals are always kept — "Remove" restores them and re-stamping re-applies the current settings.', 'يعمل في الخلفية. تُحفظ الأصول دائمًا — «إزالة» تستعيدها، وإعادة الختم تطبّق الإعدادات الحالية.')}</p>
    </form>
  );
}
