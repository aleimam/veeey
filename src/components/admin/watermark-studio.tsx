'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { pick } from '@/lib/admin-i18n';
import { inputCls } from '@/components/admin/ui';
import { saveWatermarkSettingsAction } from '@/server/watermark-actions';
import { WATERMARK_POSITIONS, previewAlign, type WatermarkSettings, type WatermarkPosition, type WatermarkLogo } from '@/lib/watermark';

/** Settings editor with a live CSS preview (mirrors the sharp compositing). */
export function WatermarkStudio({
  locale,
  initial,
  sampleImage,
  logos,
}: {
  locale: string;
  initial: WatermarkSettings;
  sampleImage: string | null;
  logos: { icon: string; horizontal: string; transparent: string };
}) {
  const tb = pick(useLocale());
  const [s, setS] = useState<WatermarkSettings>(initial);
  const set = <K extends keyof WatermarkSettings>(k: K, v: WatermarkSettings[K]) => setS((p) => ({ ...p, [k]: v }));

  const logoUrl = s.logo === 'horizontal' ? logos.horizontal : s.logo === 'transparent' ? logos.transparent : logos.icon;
  const align = previewAlign(s.position);
  const dark = s.logo === 'transparent';

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Controls (post to the save action) */}
      <form action={saveWatermarkSettingsAction} className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="position" value={s.position} />

        <label className="block text-sm font-medium">{tb('Which logo to stamp', 'أي شعار يُستخدم')}
          <select name="logo" value={s.logo} onChange={(e) => set('logo', e.target.value as WatermarkLogo)} className={inputCls}>
            <option value="icon">{tb('Icon-only mark (recommended)', 'شعار الأيقونة (مُوصى)')}</option>
            <option value="horizontal">{tb('Horizontal logo', 'الشعار الأفقي')}</option>
            <option value="transparent">{tb('Transparent (white) logo', 'الشعار الشفاف (الأبيض)')}</option>
          </select>
        </label>

        <div>
          <p className="mb-1 text-sm font-medium">{tb('Position', 'الموضع')}</p>
          <div className="inline-grid grid-cols-3 gap-1 rounded-md border border-border p-1">
            {WATERMARK_POSITIONS.map((p) => (
              <button key={p} type="button" onClick={() => set('position', p as WatermarkPosition)}
                className={`size-8 rounded ${s.position === p ? 'bg-primary text-primary-foreground' : 'bg-surface hover:bg-accent'}`} aria-label={p}>
                <span className="block size-1.5 rounded-full bg-current mx-auto" style={{ opacity: s.position === p ? 1 : 0.4 }} />
              </button>
            ))}
          </div>
        </div>

        <label className="block text-sm font-medium">{tb('Size', 'الحجم')} — {s.sizePct}% {tb('of image width', 'من عرض الصورة')}
          <input name="sizePct" type="range" min={5} max={60} value={s.sizePct} onChange={(e) => set('sizePct', Number(e.target.value))} className="w-full" />
        </label>
        <label className="block text-sm font-medium">{tb('Opacity', 'الشفافية')} — {s.opacity}%
          <input name="opacity" type="range" min={5} max={100} value={s.opacity} onChange={(e) => set('opacity', Number(e.target.value))} className="w-full" />
        </label>
        <label className="block text-sm font-medium">{tb('Margin', 'الهامش')} — {s.marginPct}%
          <input name="marginPct" type="range" min={0} max={20} value={s.marginPct} onChange={(e) => set('marginPct', Number(e.target.value))} className="w-full" />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="autoStamp" defaultChecked={s.autoStamp} className="size-4" />
          {tb('Auto-stamp new product photos on upload', 'ختم صور المنتجات الجديدة تلقائيًا عند الرفع')}
        </label>

        <button className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">{tb('Save watermark settings', 'حفظ إعدادات العلامة المائية')}</button>
      </form>

      {/* Live preview */}
      <div>
        <p className="mb-2 text-sm font-medium">{tb('Live preview', 'معاينة مباشرة')}</p>
        <div className="relative overflow-hidden rounded-lg border border-border" style={{ aspectRatio: '1 / 1', background: dark ? '#235c3c' : '#f4f6f3' }}>
          {sampleImage ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={sampleImage} alt="" className="absolute inset-0 size-full object-contain" />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">{tb('No product photo to preview', 'لا توجد صورة منتج للمعاينة')}</div>
          )}
          <div className="absolute inset-0 flex" style={{ justifyContent: align.justify, alignItems: align.align, padding: `${s.marginPct}%` }}>
            {logoUrl
              /* eslint-disable-next-line @next/next/no-img-element */
              ? <img src={logoUrl} alt="" style={{ width: `${s.sizePct}%`, opacity: s.opacity / 100 }} className="object-contain" />
              : <span className="rounded bg-black/40 px-2 py-1 text-xs text-white">{tb('Upload a logo in Branding first', 'ارفع شعارًا في صفحة الهوية أولًا')}</span>}
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{tb('The preview mirrors how the watermark is composited onto photos.', 'تعكس المعاينة طريقة دمج العلامة المائية على الصور.')}</p>
      </div>
    </div>
  );
}
