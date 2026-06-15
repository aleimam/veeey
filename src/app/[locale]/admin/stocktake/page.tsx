import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listStocktakes } from '@/lib/stocktake-service';
import { listLocations } from '@/lib/location-service';
import { createStocktakeAction } from '@/server/inventory-actions';
import { StatusBadge, inputCls } from '@/components/admin/ui';
import { pick } from '@/lib/admin-i18n';

export default async function StocktakePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const [sessions, locations] = await Promise.all([listStocktakes(), listLocations()]);

  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{tb('Stocktake', 'الجرد')}</h1>

      <form action={createStocktakeAction} className="mb-8 flex flex-wrap items-end gap-2 rounded-lg border border-border p-4">
        <input type="hidden" name="locale" value={locale} />
        <label className="text-xs">
          {tb('Session name', 'اسم الجلسة')}
          <input name="name" placeholder={tb('June 2026 — Main', 'يونيو 2026 — الرئيسي')} required className={`${inputCls} w-56`} />
        </label>
        <label className="text-xs">
          {tb('Location', 'الموقع')}
          <select name="locationId" required className={`${inputCls} w-48`}>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <button className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">{tb('Start session', 'بدء جلسة')}</button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3 text-start">{tb('Name', 'الاسم')}</th>
              <th className="p-3 text-start">{tb('Location', 'الموقع')}</th>
              <th className="p-3 text-start">{tb('Counts', 'عمليات العدّ')}</th>
              <th className="p-3 text-start">{tb('Status', 'الحالة')}</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="p-3 font-medium">{s.name}</td>
                <td className="p-3 text-muted-foreground">{s.location.name}</td>
                <td className="p-3">{s._count.counts}</td>
                <td className="p-3"><StatusBadge status={s.status} /></td>
                <td className="p-3 text-end"><Link href={`/admin/stocktake/${s.id}`} className="text-primary hover:underline">{tb('Open', 'فتح')}</Link></td>
              </tr>
            ))}
            {sessions.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">{tb('No sessions yet.', 'لا توجد جلسات بعد.')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
