import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listAllShippingTypes, listZonesWithAreas } from '@/lib/shipping-service';
import { updateShippingTypeAction, saveZoneAction, deleteZoneAction } from '@/server/shipping-actions';
import { inputCls } from '@/components/admin/ui';

export default async function ShippingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [types, zones] = await Promise.all([listAllShippingTypes(), listZonesWithAreas()]);

  return (
    <div className="p-6 space-y-10">
      <section>
        <h1 className="mb-1 font-heading text-xl font-semibold">الشحن</h1>
        <p className="mb-4 text-sm text-muted-foreground">طرق التوصيل والرسوم والمناطق التي تخدمها.</p>
        <h2 className="mb-3 font-heading text-lg font-semibold">طرق التوصيل</h2>
        <div className="space-y-3">
          {types.map((t) => (
            <form key={t.type} action={updateShippingTypeAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4">
              <input type="hidden" name="type" value={t.type} />
              <input type="hidden" name="locale" value={locale} />
              <label className="text-sm font-medium">الاسم (EN)
                <input name="labelEn" defaultValue={t.labelEn} className={`${inputCls} w-48`} />
              </label>
              <label className="text-sm font-medium">الاسم (AR)
                <input name="labelAr" defaultValue={t.labelAr} dir="rtl" className={`${inputCls} w-48`} />
              </label>
              <label className="text-sm font-medium">الرسوم (ج.م)
                <input name="feeEgp" type="number" min={0} step="0.01" defaultValue={Number(t.feePiastres) / 100} className={`${inputCls} w-28`} />
              </label>
              <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={t.enabled} /> مُفعّل</label>
              <span className="pb-2 text-xs text-muted-foreground">{t.type}</span>
              <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">حفظ</button>
            </form>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold">المناطق والمناطق الفرعية ({zones.length})</h2>

        <form action={saveZoneAction} className="mb-5 flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-border p-4">
          <input type="hidden" name="locale" value={locale} />
          <label className="text-sm font-medium">اسم المنطقة
            <input name="name" required placeholder="مثال: القاهرة الكبرى" className={`${inputCls} w-48`} />
          </label>
          <label className="text-sm font-medium">المحافظة
            <input name="governorate" required placeholder="مثال: القاهرة" className={`${inputCls} w-48`} />
          </label>
          <label className="text-sm font-medium">مستوى التفصيل
            <select name="granularity" defaultValue="GOVERNORATE" className={`${inputCls} w-40`}>
              <option value="GOVERNORATE">المحافظة</option>
              <option value="AREA">مستوى المنطقة الفرعية</option>
            </select>
          </label>
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">إضافة منطقة</button>
        </form>

        <div className="space-y-3">
          {zones.map((z) => (
            <div key={z.id} className="rounded-lg border border-border p-4">
              <form action={saveZoneAction} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="id" value={z.id} />
                <input type="hidden" name="locale" value={locale} />
                <label className="text-sm font-medium">الاسم<input name="name" defaultValue={z.name} className={`${inputCls} w-44`} /></label>
                <label className="text-sm font-medium">المحافظة<input name="governorate" defaultValue={z.governorate} className={`${inputCls} w-44`} /></label>
                <label className="text-sm font-medium">مستوى التفصيل
                  <select name="granularity" defaultValue={z.granularity} className={`${inputCls} w-36`}>
                    <option value="GOVERNORATE">المحافظة</option>
                    <option value="AREA">مستوى المنطقة الفرعية</option>
                  </select>
                </label>
                <button className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface">حفظ</button>
                <Link href={`/admin/shipping/zones/${z.id}`} className="pb-2 text-sm text-primary hover:underline">المناطق الفرعية ({z._count.areas})</Link>
              </form>
              <form action={deleteZoneAction} className="mt-2">
                <input type="hidden" name="id" value={z.id} />
                <input type="hidden" name="locale" value={locale} />
                <button className="text-xs text-destructive hover:underline">حذف المنطقة</button>
              </form>
            </div>
          ))}
          {zones.length === 0 && <p className="text-sm text-muted-foreground">لا توجد مناطق بعد.</p>}
        </div>
      </section>
    </div>
  );
}
