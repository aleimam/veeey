import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getZone } from '@/lib/shipping-service';
import { saveAreaAction, deleteAreaAction } from '@/server/shipping-actions';
import { inputCls } from '@/components/admin/ui';

export default async function ZoneAreasPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const zone = await getZone(id);
  if (!zone) notFound();

  return (
    <div className="p-6">
      <Link href="/admin/shipping" className="text-sm text-primary hover:underline">← Shipping</Link>
      <h1 className="mb-1 mt-2 font-heading text-xl font-semibold">Areas — {zone.name}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{zone.governorate} · {zone.granularity}</p>

      <div className="mb-6 space-y-3">
        {zone.areas.map((a) => (
          <div key={a.id} className="rounded-lg border border-border p-4">
            <form action={saveAreaAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="zoneId" value={zone.id} />
              <input type="hidden" name="locale" value={locale} />
              <label className="text-sm font-medium">Area name<input name="name" defaultValue={a.name} className={`${inputCls} w-48`} /></label>
              <label className="text-sm font-medium">ETA text<input name="etaText" defaultValue={a.etaText ?? ''} placeholder="e.g. Today or tomorrow" className={`${inputCls} w-52`} /></label>
              <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="allowsUltraFast" defaultChecked={a.allowsUltraFast} /> UltraFast eligible</label>
              <button className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface">Save</button>
            </form>
            <form action={deleteAreaAction} className="mt-2">
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="zoneId" value={zone.id} />
              <input type="hidden" name="locale" value={locale} />
              <button className="text-xs text-destructive hover:underline">Delete area</button>
            </form>
          </div>
        ))}
        {zone.areas.length === 0 && <p className="text-sm text-muted-foreground">No areas yet.</p>}
      </div>

      <form action={saveAreaAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-border p-4">
        <input type="hidden" name="zoneId" value={zone.id} />
        <input type="hidden" name="locale" value={locale} />
        <p className="w-full text-sm font-semibold">Add area</p>
        <label className="text-sm font-medium">Area name<input name="name" required className={`${inputCls} w-48`} /></label>
        <label className="text-sm font-medium">ETA text<input name="etaText" placeholder="e.g. 1–2 working days" className={`${inputCls} w-52`} /></label>
        <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="allowsUltraFast" /> UltraFast eligible</label>
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Add area</button>
      </form>
    </div>
  );
}
