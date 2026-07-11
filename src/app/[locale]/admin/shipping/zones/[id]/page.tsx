import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getZone } from '@/lib/shipping-service';
import { saveAreaAction, saveAreasAction, deleteAreaAction } from '@/server/shipping-actions';
import { inputCls } from '@/components/admin/ui';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { pick } from '@/lib/admin-i18n';

export const dynamic = 'force-dynamic';
type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ZoneAreasPage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<SP> }) {
  const { locale, id } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const zone = await getZone(id);
  if (!zone) notFound();
  const saved = one(sp.saved);
  const failed = one(sp.failed);

  const lbl = 'text-xs font-medium';

  return (
    <div className="p-6">
      <Link href="/admin/shipping" className="text-sm text-primary hover:underline">{tb('← Shipping', '← الشحن')}</Link>
      <h1 className="mb-1 mt-2 font-heading text-xl font-semibold">{tb('Sub-areas', 'المناطق الفرعية')} — {zone.name}{zone.nameAr ? ` · ${zone.nameAr}` : ''}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{zone.governorate} · {zone.granularity} · {zone.areas.length} {tb('sub-areas', 'منطقة فرعية')}</p>

      {saved != null && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb(`Saved ${saved} sub-area(s) ✓`, `تم حفظ ${saved} منطقة ✓`)}{failed ? tb(` — ${failed} failed`, ` — فشل ${failed}`) : ''}</p>}

      {/* Save-all form: rows associate via form= attribute (no nested forms). */}
      <form id="areas-form" action={saveAreasAction}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="zoneId" value={zone.id} />
      </form>

      {zone.areas.length > 0 && (
        <div className="mb-3 flex justify-end">
          <button form="areas-form" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
            {tb('Save all sub-areas', 'حفظ كل المناطق الفرعية')}
          </button>
        </div>
      )}

      <div className="mb-6 space-y-3">
        {zone.areas.map((a) => (
          <div key={a.id} className="rounded-lg border border-border p-4">
            <input type="hidden" name="areaIds" value={a.id} form="areas-form" />
            <div className="flex flex-wrap items-end gap-3">
              <label className={lbl}>{tb('Name (EN)', 'الاسم (EN)')}<input name={`name__${a.id}`} defaultValue={a.name} form="areas-form" className={`${inputCls} w-44`} /></label>
              <label className={lbl}>{tb('Name (AR)', 'الاسم (AR)')}<input name={`nameAr__${a.id}`} defaultValue={a.nameAr ?? ''} dir="rtl" form="areas-form" className={`${inputCls} w-44`} /></label>
              <label className={lbl}>{tb('ETA min (days)', 'الحد الأدنى (أيام)')}<input name={`etaMinDays__${a.id}`} type="number" min={0} defaultValue={a.etaMinDays ?? ''} form="areas-form" className={`${inputCls} w-24`} /></label>
              <label className={lbl}>{tb('ETA max (days)', 'الحد الأقصى (أيام)')}<input name={`etaMaxDays__${a.id}`} type="number" min={0} defaultValue={a.etaMaxDays ?? ''} form="areas-form" className={`${inputCls} w-24`} /></label>
              <label className={lbl}>{tb('Label override (optional)', 'نص بديل (اختياري)')}<input name={`etaText__${a.id}`} defaultValue={a.etaText ?? ''} placeholder={tb('e.g. today or tomorrow', 'مثال: اليوم أو غدًا')} form="areas-form" className={`${inputCls} w-44`} /></label>
              <label className="flex items-center gap-2 pb-2 text-xs"><input type="checkbox" name={`allowsUltraFast__${a.id}`} defaultChecked={a.allowsUltraFast} form="areas-form" /> {tb('UltraFast', 'UltraFast')}</label>
              <label className="flex items-center gap-2 pb-2 text-xs"><input type="checkbox" name={`allowsPos__${a.id}`} defaultChecked={a.allowsPos} form="areas-form" /> {tb('POS on delivery', 'دفع بالبطاقة عند الاستلام')}</label>
              <form action={deleteAreaAction} className="pb-1">
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="zoneId" value={zone.id} />
                <input type="hidden" name="locale" value={locale} />
                <ConfirmButton warn={tb(`Delete the sub-area "${a.name}"?`, `حذف المنطقة الفرعية "${a.name}"؟`)} className="text-xs text-destructive hover:underline">
                  {tb('Delete', 'حذف')}
                </ConfirmButton>
              </form>
            </div>
          </div>
        ))}
        {zone.areas.length === 0 && <p className="text-sm text-muted-foreground">{tb('No sub-areas yet — add the first one below.', 'لا توجد مناطق فرعية بعد — أضف الأولى بالأسفل.')}</p>}
      </div>

      <form action={saveAreaAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-border p-4">
        <input type="hidden" name="zoneId" value={zone.id} />
        <input type="hidden" name="locale" value={locale} />
        <p className="w-full text-sm font-semibold">{tb('Add sub-area', 'إضافة منطقة فرعية')}</p>
        <label className={lbl}>{tb('Name (EN)', 'الاسم (EN)')}<input name="name" required className={`${inputCls} w-44`} /></label>
        <label className={lbl}>{tb('Name (AR)', 'الاسم (AR)')}<input name="nameAr" dir="rtl" className={`${inputCls} w-44`} /></label>
        <label className={lbl}>{tb('ETA min (days)', 'الحد الأدنى (أيام)')}<input name="etaMinDays" type="number" min={0} className={`${inputCls} w-24`} /></label>
        <label className={lbl}>{tb('ETA max (days)', 'الحد الأقصى (أيام)')}<input name="etaMaxDays" type="number" min={0} className={`${inputCls} w-24`} /></label>
        <label className="flex items-center gap-2 pb-2 text-xs"><input type="checkbox" name="allowsUltraFast" /> {tb('UltraFast', 'UltraFast')}</label>
        <label className="flex items-center gap-2 pb-2 text-xs"><input type="checkbox" name="allowsPos" /> {tb('POS on delivery', 'دفع بالبطاقة عند الاستلام')}</label>
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{tb('Add sub-area', 'إضافة منطقة فرعية')}</button>
      </form>
    </div>
  );
}
